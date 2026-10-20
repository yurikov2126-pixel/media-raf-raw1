import {RadioSourcePcmOverlap} from './radioSourcePcmOverlap.js';
/** Resolve an uncommitted tail at an authorized source boundary.
 * When the target decoder is missing, flush outgoing tail unchanged.
 * This function NEVER sends PCM to an encoder by itself.
 */
export function completeDeferredHandover({
 tail,incoming,source,target,overlapMs=1500,curve='equalPower',
 authority=true,targetReady=true
}={}){
 if(!Buffer.isBuffer(tail)||tail.length%4)throw new TypeError('Invalid outgoing PCM');
 if(incoming!==null&&(!Buffer.isBuffer(incoming)||incoming.length%4))
  throw new TypeError('Invalid incoming PCM');
 if(!authority||!targetReady||!incoming||incoming.length<tail.length||
   !source?.id||!target?.id||source.id===target.id){
  return {pcm:Buffer.from(tail),status:'OUTGOING_FALLBACK',targetFramesConsumed:0};
 }
 if(tail.length!==overlapMs*192)
  throw new RangeError('Held PCM window must match overlap duration');
 const mixer=new RadioSourcePcmOverlap({source,target,overlapMs,curve});
 const ready=mixer.start({sourceReady:true,targetReady:true,slotAuthority:authority});
 if(!ready.ok)return {pcm:Buffer.from(tail),status:'OUTGOING_FALLBACK',targetFramesConsumed:0};
 const mixed=mixer.push(tail,incoming.subarray(0,tail.length));
 if(mixed.status!=='COMPLETED'||mixed.frames*4!==tail.length)
  throw new Error('Unexpected incomplete handover');
 return {pcm:mixed.pcm,status:'MIXED',targetFramesConsumed:mixed.frames};
}
