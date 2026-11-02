import {prepareMchsBoundExecution} from './mchsBoundExecutionPreflight.js';
import {runMchsTwoChannelExecution} from './mchsTwoChannelExecutor.js';

/** Event-bound two-channel dispatcher for an independently isolated test.
 * A passed preflight is not public broadcast authorization. No live Android
 * route may call this without physical output isolation and explicit approval.
 */
export async function dispatchIsolatedMchsEvent({
 observation,checkpoint,rules,asset,bytes,workerAsset,agentAsset,
 seenIds=new Set(),officialSourceVerified=false,
 authorization,worker,agent,signal,now=()=>Date.now(),onProgress=()=>{}
}={}){
 const deny=reason=>({ok:false,reason,automaticBroadcastEnabled:false,
  checkpointCommitted:false,requiresOperatorReview:false});
 const preflight=prepareMchsBoundExecution({observation,checkpoint,rules,asset,bytes,
  workerAsset,agentAsset,seenIds,officialSourceVerified,nowMs:now()});
 if(!preflight.ready)return deny(preflight.reason);
 if(!authorization||authorization.mode!=='ISOLATED_TRIAL'||
  authorization.approved!==true||authorization.publicStreamAllowed!==false||
  authorization.amplifierAllowed!==false||authorization.outputIsolationVerified!==true)
  return deny('ISOLATED_TEST_AUTHORIZATION_REQUIRED');
 if(typeof worker?.start!=='function'||typeof worker?.stop!=='function'||
  typeof worker?.waitUntilCompleted!=='function'||typeof agent?.start!=='function'||
  typeof agent?.stop!=='function'||typeof agent?.waitUntilCompleted!=='function')
  return deny('INCOMPLETE_EXECUTION_TRANSPORT');
 const event={id:preflight.binding.eventId,eventType:preflight.binding.eventType,
  assetId:preflight.binding.assetId,repeats:preflight.binding.repeats,
  occurredAt:observation.occurredAt};
 onProgress({phase:'DISPATCH_START',eventId:event.id});
 let result;
 try {
  result=await runMchsTwoChannelExecution({event,authorization,worker,agent,signal,now});
 } catch(error) {
  const stopped=await Promise.allSettled([
   Promise.resolve().then(()=>worker.stop(event)),
   Promise.resolve().then(()=>agent.stop(event))
  ]);
  return { ...deny('EXECUTOR_FAILED'),requiresOperatorReview:true,
   stopRequestsSettled:stopped.every(item=>item.status==='fulfilled')};
 }
 onProgress({phase:result.ok?'COMPLETED':'FAILED',eventId:event.id,reason:result.reason});
 return {...result,automaticBroadcastEnabled:false,checkpointCommitted:false,
  proposedCheckpoint:result.ok?{state:preflight.proposedState,
    lastSourceEventId:preflight.sourceEventId}:null};
}
