/** Validates internal media-gateway PCM packets before session-bound ingestion.
 * Signed 16-bit stereo 48kHz, maximum 100ms, sequential timestamps.
 */
export class PcmGatewayClock {
 constructor({sampleRate=48000,maxPacketMs=100}={}){
  this.sampleRate=sampleRate;this.maxFrames=Math.round(sampleRate*maxPacketMs/1000);
  this.expectedFrame=null;this.acceptedFrames=0;this.discontinuities=0;
 }
 validate({pcm,frameIndex}){
  if(!Buffer.isBuffer(pcm)||!pcm.length||pcm.length%4!==0)
   throw new TypeError('Invalid interleaved stereo s16le payload');
  const frames=pcm.length/4;
  if(frames>this.maxFrames)throw new RangeError('PCM packet too large');
  if(!Number.isSafeInteger(frameIndex)||frameIndex<0)throw new TypeError('Invalid sample clock');
  if(this.expectedFrame!==null&&frameIndex!==this.expectedFrame){
   this.discontinuities++;
   throw new RangeError('Discontinuous PCM clock');
  }
  this.expectedFrame=frameIndex+frames;this.acceptedFrames+=frames;
  return {frames,acceptedFrames:this.acceptedFrames,expectedFrame:this.expectedFrame};
 }
 reset(){this.expectedFrame=null;this.acceptedFrames=0;this.discontinuities=0;}
 snapshot(){return {sampleRate:this.sampleRate,acceptedFrames:this.acceptedFrames,
  expectedFrame:this.expectedFrame,discontinuities:this.discontinuities};}
}
