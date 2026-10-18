/** Isolated PCM telemetry and bounded staging, not connected to the station encoder.
 * Frames are 20ms, stereo 48kHz s16le: 3840 bytes / 960 samples per channel.
 * No fabricated silence, replay, or packet concealment is introduced.
 */
export class RadioPcmStaging {
  constructor({frameBytes=3840,frameMs=20,maxFrames=50,staleAfterMs=1500}={}) {
    if(!Number.isSafeInteger(frameBytes)||frameBytes<4||frameBytes%4||
      !Number.isSafeInteger(frameMs)||frameMs<=0||
      !Number.isSafeInteger(maxFrames)||maxFrames<1||
      !Number.isFinite(staleAfterMs)||staleAfterMs<=0) throw new TypeError('Invalid PCM staging configuration');
    this.frameBytes=frameBytes;this.frameMs=frameMs;this.maxFrames=maxFrames;
    this.staleAfterMs=staleAfterMs;this.reset();
  }
  reset(){
    this.queue=[];this.nextIndex=null;this.lastAt=null;
    this.accepted=0;this.rejected=0;this.discontinuities=0;this.overflows=0;
  }
  push({pcm,frameIndex},nowMs=Date.now()){
    if(!Buffer.isBuffer(pcm)||pcm.length!==this.frameBytes||
      !Number.isSafeInteger(frameIndex)||frameIndex<0||!Number.isFinite(nowMs))
      return this.reject('INVALID_PCM');
    if(this.lastAt!==null&&(nowMs<this.lastAt||nowMs-this.lastAt>this.staleAfterMs)){
      this.clearQueue();this.discontinuities++; // never join unrelated epochs
      return this.reject('STALE_PCM_EPOCH');
    }
    if(this.nextIndex!==null && frameIndex!==this.nextIndex){
      this.clearQueue();this.discontinuities++;
      return this.reject('PCM_DISCONTINUITY');
    }
    if(this.queue.length>=this.maxFrames){
      this.overflows++;this.clearQueue();
      return this.reject('PCM_OVERFLOW');
    }
    this.queue.push({pcm:Buffer.from(pcm),frameIndex});
    this.nextIndex=frameIndex+this.frameBytes/4;
    this.lastAt=nowMs;this.accepted++;
    return {accepted:true,bufferedMs:this.queue.length*this.frameMs};
  }
  clearQueue(){this.queue=[];this.nextIndex=null;this.lastAt=null;}
  reject(reason){this.rejected++;return {accepted:false,reason};}
  // Explicit dequeue is for isolated harnesses only. Do not wire to on-air output.
  shift(){return this.queue.shift()||null;}
  snapshot(nowMs=Date.now()){
    const fresh=this.lastAt!==null&&nowMs>=this.lastAt&&nowMs-this.lastAt<=this.staleAfterMs;
    return {bufferedMs:this.queue.length*this.frameMs,bufferedFrames:this.queue.length,
      lastPcmAt:this.lastAt,pcmFresh:fresh,accepted:this.accepted,rejected:this.rejected,
      discontinuities:this.discontinuities,overflows:this.overflows,
      liveOutputConnected:false};
  }
}
