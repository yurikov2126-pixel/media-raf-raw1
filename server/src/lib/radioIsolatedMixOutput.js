import {mixRadioPcmFrames} from './radioIsolatedLiveMixer.js';
import {RadioPrivateLivePcmQueue} from './radioPrivateLivePcmQueue.js';
import {RadioVoiceDuckingEnvelope} from './radioVoiceDuckingEnvelope.js';

// Isolated private audition only. No public encoder access.
export class RadioIsolatedMixOutput {
 constructor({musicSample=null}={}){this.envelope=new RadioVoiceDuckingEnvelope();this.musicSample=musicSample;this.queue=new RadioPrivateLivePcmQueue();this.reset();}
 reset(){this.queue.reset();this.sampleCursor=0;this.mixedFrames=0;this.musicSample?.reset();this.envelope.reset();}
 accept(pcm,nowMs){
  if(!Buffer.isBuffer(pcm)||pcm.length!==3840||!Number.isFinite(nowMs))throw new TypeError('INVALID_PCM');
  const music=this.musicSample?this.musicSample.next():Buffer.alloc(3840);
  if(!this.musicSample)for(let i=0;i<960;i++){
   const s=Math.round(1800*Math.sin(2*Math.PI*440*(this.sampleCursor+i)/48000));
   music.writeInt16LE(s,i*4);music.writeInt16LE(s,i*4+2);
  }
  this.sampleCursor+=960;
  const duck=this.envelope.step(pcm);
  this.queue.push(mixRadioPcmFrames({music,voice:pcm,ducking:duck.musicGain}).pcm,nowMs);
  this.mixedFrames++;
  return {ok:true,connectedToEncoder:false,changeApplied:false};
 }
 read(args){return this.queue.read(args);}
 snapshot(){return {mode:this.musicSample?'ISOLATED_REAL_MUSIC_SAMPLE':'ISOLATED_MIX',mixedFrames:this.mixedFrames,ducking:this.envelope.snapshot(),...this.queue.snapshot(),connectedToEncoder:false,changeApplied:false};}
}
