import {assessMissileAutoEvent,missileNextState} from './mchsMissileAutoGate.js';
import {runMchsTwoChannelExecution} from './mchsTwoChannelExecutor.js';

/** Integration boundary: accepts a real, authenticated Android event only after
 * preconfigured verified safe test output adapters are supplied. Never toggles
 * public playback or ESP32, and never overrides operatorHold.
 */
export async function executeMchsControlledAcceptance({
 event,checkpoint,rules,seenIds=new Set(),sourceOfficiallyVerified=false,
 operatorHold=true,authorization,worker,agent,signal,now=()=>Date.now(),
 onProgress=()=>{}
}={}){
 const decision=assessMissileAutoEvent(event,{rules,seenIds,nowMs:now()});
 const denied=reason=>({ok:false,reason,executionEnabled:false,eventId:event?.id||null});
 if(!decision.eligible)return denied(decision.reason);
 const next=missileNextState(checkpoint?.state||'UNKNOWN',decision.eventType);
 if(!next.accepted)return denied(next.reason);
 if(!sourceOfficiallyVerified)return denied('OFFICIAL_SOURCE_NOT_VERIFIED');
 if(operatorHold)return denied('OPERATOR_HOLD');
 if(!authorization||authorization.mode!=='ISOLATED_TRIAL'||
  authorization.approved!==true||authorization.publicStreamAllowed!==false||
  authorization.amplifierAllowed!==false)return denied('TRIAL_AUTHORIZATION_REQUIRED');
 if(typeof worker?.start!=='function'||typeof worker?.stop!=='function'||
  typeof worker?.waitUntilCompleted!=='function'||typeof agent?.start!=='function'||
  typeof agent?.stop!=='function'||typeof agent?.waitUntilCompleted!=='function')
  return denied('INCOMPLETE_CHANNEL_TRANSPORT');
 const repeats=decision.eventType==='MISSILE_ALL_CLEAR'?1:rules?.MISSILE_DANGER?.repeats;
 if(!Number.isInteger(repeats)||repeats<1||repeats>5)return denied('INVALID_REPEATS');
 const audioEvent={id:event.id,eventType:decision.eventType,assetId:decision.audioAssetId,
  repeats,occurredAt:event.occurredAt};
 onProgress({phase:'START_REQUESTED',eventId:event.id});
 const result=await runMchsTwoChannelExecution({event:audioEvent,authorization,
  worker,agent,signal,now});
 onProgress({phase:result.ok?'STOP_CONFIRMED':'FAILED',eventId:event.id,reason:result.reason});
 return {...result,executionEnabled:false,sourceEventId:event.sourceEventId,
  proposedCheckpoint:result.ok?{state:next.state,lastSourceEventId:event.sourceEventId}:null};
}
