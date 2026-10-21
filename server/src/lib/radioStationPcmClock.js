/**
 * Authoritative station transition clock, independent of decoder progress.
 * Immutable scheduled boundary + monotonic output-frame counter.
 * All times are absolute milliseconds; PCM is stereo s16le at 48kHz.
 * This component does not touch the running encoder or alter scheduling.
 */
export class RadioStationPcmClock {
 constructor({sampleRate=48000,channels=2,bytesPerSample=2,overlapMs=1500,maxDriftMs=900}={}){
  if(!Number.isSafeInteger(sampleRate)||sampleRate<=0||
    !Number.isSafeInteger(channels)||channels<=0||
    !Number.isSafeInteger(bytesPerSample)||bytesPerSample<=0||
    !Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000||
    !Number.isFinite(maxDriftMs)||maxDriftMs<0)throw new TypeError('Invalid PCM clock');
  Object.assign(this,{sampleRate,channels,bytesPerSample,overlapMs,maxDriftMs});
  this.boundaryMs=null;this.sourceId=null;this.framesOut=0;this.startedAtMs=null;
 }
 arm({sourceId,boundaryMs,startAtMs}={}){
  if(!sourceId||!Number.isFinite(boundaryMs)||!Number.isFinite(startAtMs)||
    startAtMs>=boundaryMs)throw new TypeError('Invalid scheduled boundary');
  this.sourceId=sourceId;this.boundaryMs=boundaryMs;
  this.startedAtMs=startAtMs;this.framesOut=0;
  return this.snapshot(startAtMs);
 }
 emit(bytes){
  if(this.boundaryMs===null)throw new Error('PCM clock is not armed');
  const frameBytes=this.channels*this.bytesPerSample;
  if(!Number.isSafeInteger(bytes)||bytes<0||bytes%frameBytes)
    throw new TypeError('Unaligned PCM packet');
  this.framesOut+=bytes/frameBytes;
  return this.framesOut;
 }
 snapshot(nowMs){
  if(this.boundaryMs===null||!Number.isFinite(nowMs))
    throw new TypeError('Invalid clock snapshot');
  const playedMs=this.framesOut*1000/this.sampleRate;
  const sourcePcmTimeMs=this.startedAtMs+playedMs;
  const driftMs=sourcePcmTimeMs-nowMs;
  const boundaryInMs=this.boundaryMs-nowMs;
  const overlapBeginsAtMs=this.boundaryMs-this.overlapMs;
  return {sourceId:this.sourceId,boundaryMs:this.boundaryMs,
    framesOut:this.framesOut,playedMs,sourcePcmTimeMs,driftMs,
    boundaryInMs,overlapBeginsAtMs,
    inOverlapWindow:nowMs>=overlapBeginsAtMs&&nowMs<this.boundaryMs,
    synchronized:Math.abs(driftMs)<=this.maxDriftMs,
    expired:nowMs>=this.boundaryMs};
 }
 decision(nowMs,{sourceReady=false,targetReady=false,authority=false,publicLive=false}={}){
  const clock=this.snapshot(nowMs);
  const reason=clock.expired?'BOUNDARY_PASSED':
    publicLive?'PUBLIC_LIVE':
    !authority?'NO_AUTHORITY':
    !sourceReady?'SOURCE_NOT_READY':
    !targetReady?'TARGET_NOT_READY':
    !clock.synchronized?'PCM_DRIFT':
    !clock.inOverlapWindow?'OUTSIDE_OVERLAP':null;
  return {ok:reason===null,reason,...clock};
 }
}
