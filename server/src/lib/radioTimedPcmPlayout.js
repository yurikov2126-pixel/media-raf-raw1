/**
 * Audio Engine 4.1: deterministic, manually ticked PCM playout simulation.
 * This module has no clock, socket or encoder side effects. Never connect to PA.
 * Packet loss is an explicit failure, not manufactured silence or replay.
 */
export class RadioTimedPcmPlayout {
  constructor({frameMs=20,frameBytes=3840,prebufferFrames=5,maxFrames=50,staleMs=1500}={}){
    if(!Number.isSafeInteger(frameMs)||frameMs<1||!Number.isSafeInteger(frameBytes)||frameBytes<4||frameBytes%4||
      !Number.isSafeInteger(prebufferFrames)||prebufferFrames<1||
      !Number.isSafeInteger(maxFrames)||maxFrames<prebufferFrames||
      !Number.isFinite(staleMs)||staleMs<frameMs)throw new TypeError('Invalid playout configuration');
    Object.assign(this,{frameMs,frameBytes,prebufferFrames,maxFrames,staleMs});
    this.reset();
  }
  reset(){
    this.queue=[];this.expected=null;this.lastReceivedAt=null;this.nextDueAt=null;
    this.state='BUFFERING';this.reason=null;this.emitted=0;this.failures=0;
  }
  fail(reason){
    this.queue=[];this.expected=null;this.nextDueAt=null;
    this.state='FAILED';this.reason=reason;this.failures++;
    return {ok:false,reason,output:null};
  }
  push({pcm,frameIndex},nowMs){
    if(this.state==='FAILED')return {ok:false,reason:'RESET_REQUIRED'};
    if(!Buffer.isBuffer(pcm)||pcm.length!==this.frameBytes||
      !Number.isSafeInteger(frameIndex)||frameIndex<0||!Number.isFinite(nowMs))
      return this.fail('INVALID_FRAME');
    if(this.lastReceivedAt!==null&&(nowMs<this.lastReceivedAt||nowMs-this.lastReceivedAt>this.staleMs))
      return this.fail('STALE_INPUT');
    if(this.expected!==null&&frameIndex!==this.expected)return this.fail('SEQUENCE_GAP');
    if(this.queue.length>=this.maxFrames)return this.fail('BUFFER_OVERFLOW');
    this.queue.push({pcm:Buffer.from(pcm),frameIndex});
    this.expected=frameIndex+this.frameBytes/4;
    this.lastReceivedAt=nowMs;
    return {ok:true,bufferedMs:this.queue.length*this.frameMs};
  }
  tick(nowMs){
    if(!Number.isFinite(nowMs))return this.fail('INVALID_CLOCK');
    if(this.state==='FAILED')return {ok:false,reason:this.reason,output:null};
    if(this.lastReceivedAt!==null&&nowMs-this.lastReceivedAt>this.staleMs)
      return this.fail('STALE_INPUT');
    if(this.state==='BUFFERING'){
      if(this.queue.length<this.prebufferFrames)return {ok:true,state:'BUFFERING',output:null};
      this.state='READY';this.nextDueAt=nowMs;
    }
    if(nowMs<this.nextDueAt)return {ok:true,state:'READY',output:null};
    // A delayed scheduler must never burst-play cached audio to catch up.
    if(nowMs-this.nextDueAt>=this.frameMs)return this.fail('TIMER_OVERRUN');
    const frame=this.queue.shift();
    if(!frame)return this.fail('BUFFER_UNDERRUN');
    this.nextDueAt+=this.frameMs;this.emitted++;
    return {ok:true,state:'READY',output:frame};
  }
  snapshot(nowMs){
    return {state:this.state,reason:this.reason,bufferedFrames:this.queue.length,
      bufferedMs:this.queue.length*this.frameMs,pcmLastAt:this.lastReceivedAt,
      fresh:this.lastReceivedAt!==null&&Number.isFinite(nowMs)&&nowMs>=this.lastReceivedAt&&
        nowMs-this.lastReceivedAt<=this.staleMs,emitted:this.emitted,failures:this.failures,
      connectedToEncoder:false};
  }
}
