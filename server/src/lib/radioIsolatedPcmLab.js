import {RadioTimedPcmPlayout} from './radioTimedPcmPlayout.js';
import {mixRadioPcmFrames} from './radioIsolatedLiveMixer.js';

/**
 * Audio Engine 5.1: output-disconnected PCM laboratory.
 * Uses real decoded voice frames, but synthetic music exists ONLY in this harness.
 * All mixed frames are checksum-accounted and then discarded; no encoder access.
 */
export class RadioIsolatedPcmLab {
  constructor({prebufferFrames=5,maxFrames=50,staleMs=1500,frameMs=20,
    sampleRate=48000,frequencyHz=440,musicAmplitude=2000}={}){
    if(sampleRate!==48000||!Number.isFinite(frequencyHz)||frequencyHz<=0||frequencyHz>=24000||
      !Number.isSafeInteger(musicAmplitude)||musicAmplitude<0||musicAmplitude>32767)
      throw new TypeError('INVALID_LAB_CONFIG');
    this.playout=new RadioTimedPcmPlayout({prebufferFrames,maxFrames,staleMs,frameMs});
    this.frequencyHz=frequencyHz;this.musicAmplitude=musicAmplitude;
    this.reset();
  }
  reset(){
    this.playout.reset();this.frameCount=0;this.checksum=0;this.peak=0;
    this.underruns=0;this.lastError=null;this.generatedSamples=0;
  }
  push(packet,nowMs){
    const r=this.playout.push(packet,nowMs);
    if(!r.ok)this.lastError=r.reason;
    return r;
  }
  // Invoked by the Worker shadow's 20-ms clock. No timers are created here.
  tick(nowMs){
    const r=this.playout.tick(nowMs);
    if(!r.ok){
      this.lastError=r.reason;
      if(r.reason==='BUFFER_UNDERRUN')this.underruns++;
      return {ok:false,reason:r.reason,outputDiscarded:true,connectedToEncoder:false};
    }
    if(!r.output)return {ok:true,buffering:r.state==='BUFFERING',outputDiscarded:true,connectedToEncoder:false};
    const music=Buffer.alloc(3840);
    for(let i=0;i<960;i++){
      const sample=Math.round(Math.sin(2*Math.PI*this.frequencyHz*(this.generatedSamples+i)/48000)*this.musicAmplitude);
      music.writeInt16LE(sample,i*4);
      music.writeInt16LE(sample,i*4+2);
    }
    this.generatedSamples+=960;
    const result=mixRadioPcmFrames({music,voice:r.output.pcm,ducking:0.25});
    for(let i=0;i<result.pcm.length;i+=2){
      const sample=result.pcm.readInt16LE(i);
      this.peak=Math.max(this.peak,Math.abs(sample));
      this.checksum=(this.checksum+(sample&65535))>>>0;
    }
    this.frameCount++;
    // Intentionally NO returned PCM. Only aggregate read-only telemetry.
    return {ok:true,frameIndex:r.output.frameIndex,outputDiscarded:true,connectedToEncoder:false};
  }
  snapshot(nowMs=Date.now()){
    return {mode:'DISCARD_ONLY_PCM_LAB',...this.playout.snapshot(nowMs),
      framesMixed:this.frameCount,checksum:this.checksum,peak:this.peak,
      underruns:this.underruns,lastError:this.lastError,
      outputDiscarded:true,connectedToEncoder:false,changeApplied:false};
  }
}
