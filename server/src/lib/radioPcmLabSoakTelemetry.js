/** Bounded, read-only telemetry for the isolated PCM lab.
 * No raw audio, socket IDs, tokens or output control are retained.
 */
export class RadioPcmLabSoakTelemetry {
 constructor({frameMs=20,historySize=120}={}){
  if(!Number.isSafeInteger(frameMs)||frameMs<1||
    !Number.isSafeInteger(historySize)||historySize<1||historySize>3600)
    throw new TypeError('INVALID_SOAK_CONFIG');
  this.frameMs=frameMs;this.historySize=historySize;this.reset();
 }
 reset(){
  this.startedAt=null;this.lastTickAt=null;this.ticks=0;this.deadlineMisses=0;
  this.maxLatenessMs=0;this.maxGapMs=0;this.acceptedFrames=0;this.failedFrames=0;
  this.failures=[];this.latenessSamples=[];this.highWaterBufferedMs=0;
 }
 receive(result,bufferedMs=0){
  if(result?.ok)this.acceptedFrames++;
  else {this.failedFrames++;this.fault(result?.reason||'INGEST_FAILED');}
  if(Number.isFinite(bufferedMs)&&bufferedMs>=0)
   this.highWaterBufferedMs=Math.max(this.highWaterBufferedMs,bufferedMs);
 }
 tick(nowMs,result){
  if(!Number.isFinite(nowMs))return this.fault('CLOCK_INVALID');
  if(this.startedAt===null)this.startedAt=nowMs;
  if(this.lastTickAt!==null){
   const gap=nowMs-this.lastTickAt;
   if(gap<0)return this.fault('CLOCK_REVERSED');
   const lateness=Math.max(0,gap-this.frameMs);
   this.maxGapMs=Math.max(this.maxGapMs,gap);
   this.maxLatenessMs=Math.max(this.maxLatenessMs,lateness);
   if(lateness>0)this.deadlineMisses++;
   this.latenessSamples.push(lateness);
   if(this.latenessSamples.length>this.historySize)this.latenessSamples.shift();
  }
  this.lastTickAt=nowMs;this.ticks++;
  if(result&&!result.ok)this.fault(result.reason||'PLAYOUT_FAILED');
 }
 fault(reason){
  this.failures.push({reason:String(reason).slice(0,64),tick:this.ticks});
  if(this.failures.length>this.historySize)this.failures.shift();
 }
 snapshot(nowMs=Date.now()){
  const arr=[...this.latenessSamples].sort((a,b)=>a-b);
  const p95=arr.length?arr[Math.ceil(arr.length*0.95)-1]:0;
  return {mode:'ISOLATED_SOAK_ONLY',uptimeMs:this.startedAt!==null&&
   Number.isFinite(nowMs)?Math.max(0,nowMs-this.startedAt):0,
   ticks:this.ticks,deadlineMisses:this.deadlineMisses,maxGapMs:this.maxGapMs,
   maxLatenessMs:this.maxLatenessMs,p95LatenessMs:p95,
   acceptedFrames:this.acceptedFrames,failedFrames:this.failedFrames,
   highWaterBufferedMs:this.highWaterBufferedMs,failures:this.failures.slice(-10),
   connectedToEncoder:false,changeApplied:false};
 }
}
