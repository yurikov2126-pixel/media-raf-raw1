import {createHandoverSession} from './radioDualDeckPcm.js';
import {RadioHandoverController} from './radioHandoverController.js';

/** Pair independent 48kHz/stereo/s16le PCM decks into exactly-once overlap frames.
 * This module has no audio device, worker, decoder or output side effects.
 */
export class RadioSourcePcmOverlap {
 constructor({source,target,overlapMs=1500,curve='equalPower'}={}){
  this.settings={overlapMs,curve};
  this.controller=new RadioHandoverController({overlapMs});
  this.source=source;this.target=target;
  this.mixer=createHandoverSession(this.settings);
  this.sourceQueue=Buffer.alloc(0);this.targetQueue=Buffer.alloc(0);
  this.framesOut=0;this.closed=false;this.fallback=null;
 }
 start({sourceReady,targetReady,publicLive=false,slotAuthority=false}={}){
  const result=this.controller.reserve({source:this.source,target:this.target,
    sourceReady,targetReady,publicLive,slotAuthority});
  if(!result.ok){this.fallback=result.fallback||null;return {ok:false,reason:result.reason};}
  return this.controller.start();
 }
 push(sourcePcm,targetPcm){
  if(this.closed)throw new Error('Overlap completed');
  for(const pcm of [sourcePcm,targetPcm])
   if(!Buffer.isBuffer(pcm)||pcm.length%4)throw new TypeError('Unaligned stereo PCM');
  this.sourceQueue=Buffer.concat([this.sourceQueue,sourcePcm]);
  this.targetQueue=Buffer.concat([this.targetQueue,targetPcm]);
  return this.drain();
 }
 drain(){
  if(this.controller.phase!=='MIXING')return {pcm:Buffer.alloc(0),frames:0,status:this.controller.phase};
  const frames=Math.min(this.sourceQueue.length/4,this.targetQueue.length/4,
    this.controller.snapshot().targetFrameOffset>=0?
      this.settings.overlapMs*48-this.framesOut:0);
  if(!frames)return {pcm:Buffer.alloc(0),frames:0,status:'WAITING_FOR_BOTH_DECKS'};
  const count=frames*4;
  const a=this.sourceQueue.subarray(0,count),b=this.targetQueue.subarray(0,count);
  const mixed=this.mixer.write(a,b);
  const committed=this.controller.commit(frames);
  if(!committed.ok)throw new Error(committed.reason);
  this.sourceQueue=this.sourceQueue.subarray(count);
  this.targetQueue=this.targetQueue.subarray(count);
  this.framesOut+=frames;
  if(committed.completed)this.closed=true;
  return {pcm:mixed.pcm,frames,status:this.closed?'COMPLETED':'MIXING',
    targetFramesConsumed:this.framesOut};
 }
 abort(reason,{sourceAvailable=true,targetAvailable=true}={}){
  this.fallback=this.controller.fail(reason,{sourceAvailable,targetAvailable}).fallback;
  return {fallback:this.fallback,emittedTargetFrames:this.framesOut};
 }
 snapshot(){return {...this.controller.snapshot(),sourceQueuedFrames:this.sourceQueue.length/4,
  targetQueuedFrames:this.targetQueue.length/4,framesOut:this.framesOut,
  fallback:this.fallback};}
}
