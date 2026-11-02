import {assessMissileAutoEvent,missileNextState} from './mchsMissileAutoGate.js';

/** Decide whether a real Android event can enter an automatic trial queue.
 * This function NEVER starts public audio and cannot lift operator HOLD.
 */
export function planMchsAndroidControlledTrial({event,checkpoint,seenIds=new Set(),
 rules={},workerReady=false,agentReady=false,stopReady=false,
 sourceOfficiallyVerified=false,nowMs=Date.now()}={}){
 const result=assessMissileAutoEvent(event,{seenIds,rules,nowMs});
 const holds=[];
 if(!result.eligible)holds.push(result.reason);
 const next=missileNextState(checkpoint?.state||'UNKNOWN',result.eventType);
 if(!next.accepted)holds.push(next.reason);
 if(!sourceOfficiallyVerified)holds.push('OFFICIAL_SOURCE_NOT_VERIFIED');
 if(!workerReady)holds.push('WORKER_NOT_READY');
 if(!agentReady)holds.push('AGENT_NOT_READY');
 if(!stopReady)holds.push('STOP_NOT_READY');
 if(event?.sourceEventId&&checkpoint?.lastSourceEventId===event.sourceEventId)
  holds.push('EVENT_ALREADY_HANDLED');
 const repeats=result.eventType==='MISSILE_ALL_CLEAR'?1:
  Number.isInteger(rules?.MISSILE_DANGER?.repeats)?rules.MISSILE_DANGER.repeats:1;
 if(repeats<1||repeats>5)holds.push('INVALID_REPEATS');
 return {eventId:result.eventId,eventType:result.eventType,
  sourceEventId:result.sourceEventId,audioAssetId:result.audioAssetId,
  repeats,eligibleForQueue:holds.length===0,holds:[...new Set(holds)],
  nextCheckpointState:next.state,automaticPlaybackEnabled:false,
  executionAuthorized:false,output:'CONTROLLED_TRIAL_PREFLIGHT_ONLY'};
}
