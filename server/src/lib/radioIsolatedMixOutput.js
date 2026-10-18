import {mixRadioPcmFrames} from './radioIsolatedLiveMixer.js';
import {RadioPrivateLivePcmQueue} from './radioPrivateLivePcmQueue.js';

// Isolated private audition only. No public encoder access.
export class RadioIsolatedMixOutput {
 constructor(){this.queue=new RadioPrivateLivePcmQueue();this.reset();}
 reset(){this.queue.reset();this.sampleCursor=0;this.mixedFrames=0;}
 accept(pcm,nowMs){
  if(!Buffer.isBuffer(pcm)||pcm.length!==3840||!Number.isFinite(nowMs))throw new TypeError('INVALID_PCM');
  const music=Buffer.alloc(3840);
  for(let i=0;i<960;i++){
   const s=Math.round(1800*Math.sin(2*Math.PI*440*(this.sampleCursor+i)/48000));
   music.writeInt16LE(s,i*4);music.writeInt16LE(s,i*4+2);
  }
  this.sampleCursor+=960;
  this.queue.push(mixRadioPcmFrames({music,voice:pcm,ducking:0.25}).pcm,nowMs);
  this.mixedFrames++;
  return {ok:true,connectedToEncoder:false,changeApplied:false};
 }
 read(args){return this.queue.read(args);}
 snapshot(){return {mode:'ISOLATED_MIX',mixedFrames:this.mixedFrames,...this.queue.snapshot(),connectedToEncoder:false,changeApplied:false};}
}
