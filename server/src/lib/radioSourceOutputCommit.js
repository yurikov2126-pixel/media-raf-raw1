import {RadioDeferredPcmTail} from './radioDeferredPcmTail.js';
import {completeDeferredHandover} from './radioDeferredHandover.js';

/** Atomic decision point before PCM reaches the single station encoder.
 * Holds an untransmitted outgoing window and commits it exactly once.
 * Caller supplies an authorized target PCM prefix and is responsible for
 * continuing target playback at targetFramesConsumed.
 */
export class RadioSourceOutputCommit {
 constructor({overlapMs=1500,curve='equalPower',write}={}){
  if(typeof write!=='function')throw new TypeError('PCM encoder write function required');
  this.tail=new RadioDeferredPcmTail({holdMs:overlapMs});
  this.write=write;this.overlapMs=overlapMs;this.curve=curve;
  this.state='COLLECTING';this.outputBytes=0;this.targetFramesConsumed=0;
 }
 async accept(chunk){
  if(this.state!=='COLLECTING')throw new Error('Output gate no longer accepting PCM');
  const committed=this.tail.push(chunk);
  if(committed.length){await this.write(committed);this.outputBytes+=committed.length;}
  return committed.length;
 }
 async finish({incoming=null,source=null,target=null,authorized=false}={}){
  if(this.state!=='COLLECTING')throw new Error('Already committed');
  this.state='COMMITTING';
  const pending=this.tail.takeTail();
  let result={pcm:pending,status:'OUTGOING_FALLBACK',targetFramesConsumed:0};
  try{
   if(pending.length===this.overlapMs*192 && authorized && incoming)
    result=completeDeferredHandover({tail:pending,incoming,source,target,
      overlapMs:this.overlapMs,curve:this.curve,authority:true,targetReady:true});
  }catch(error){
   result={pcm:pending,status:'OUTGOING_FALLBACK',targetFramesConsumed:0,error:error.message};
  }
  try{
   if(result.pcm.length){await this.write(result.pcm);this.outputBytes+=result.pcm.length;}
   this.targetFramesConsumed=result.targetFramesConsumed;
   this.state='COMPLETED';
   return {status:result.status,targetFramesConsumed:this.targetFramesConsumed,
    emittedBytes:this.outputBytes,error:result.error||null};
  }catch(error){
   // A failed encoder write may have been partially consumed: never attempt
   // to re-send the same PCM and risk audible duplicated fragments.
   this.state='OUTPUT_FAILED';
   throw error;
  }
 }
 snapshot(){return {state:this.state,outputBytes:this.outputBytes,
  targetFramesConsumed:this.targetFramesConsumed,heldBytes:this.tail.snapshot().heldBytes};}
}
