import {assessMissileAutoEvent,missileNextState} from './mchsMissileAutoGate.js';

export const MISSILE_CHECKPOINT_KEY='mchs_missile_auto_checkpoint_v1';
export function emptyMissileCheckpoint(){return {state:'UNKNOWN',lastOccurredAt:null,lastEventId:null,processedIds:[]};}
export function normalizeMissileCheckpoint(value){
 if(!value||!['UNKNOWN','CLEAR','DANGER'].includes(value.state))return emptyMissileCheckpoint();
 return {state:value.state,lastOccurredAt:typeof value.lastOccurredAt==='string'?value.lastOccurredAt:null,
  lastEventId:typeof value.lastEventId==='string'?value.lastEventId:null,
  processedIds:Array.isArray(value.processedIds)?value.processedIds.filter(v=>typeof v==='string').slice(-500):[]};
}
/** Pure reducer: never executes audio or grants verified status to an observation. */
export function advanceMissileCheckpoint(input,events,{rules={},assets=new Set(),nowMs=Date.now()}={}){
 let checkpoint=normalizeMissileCheckpoint(input),decisions=[];
 const seen=new Set(checkpoint.processedIds);
 for(const event of [...events].sort((a,b)=>Date.parse(a.occurredAt||0)-Date.parse(b.occurredAt||0)||String(a.id).localeCompare(String(b.id)))){
  let decision=assessMissileAutoEvent(event,{rules,nowMs,seenIds:seen});
  const key=event.sourceEventId;
  if(decision.eligible&&!assets.has(decision.audioAssetId))decision={...decision,eligible:false,reason:'ALARM_AUDIO_MISSING',audioAssetId:null};
  const timestamp=event.occurredAt?Date.parse(event.occurredAt):NaN;
  if(decision.eligible&&checkpoint.lastOccurredAt&&timestamp<=Date.parse(checkpoint.lastOccurredAt))
   decision={...decision,eligible:false,reason:'OUT_OF_ORDER',audioAssetId:null};
  if(decision.eligible){
   const next=missileNextState(checkpoint.state,decision.eventType);
   if(!next.accepted)decision={...decision,eligible:false,reason:next.reason,audioAssetId:null};
   else checkpoint={...checkpoint,state:next.state,lastOccurredAt:new Date(timestamp).toISOString(),
    lastEventId:event.id};
  }
  // Only accepted events enter the idempotency checkpoint. Rejected observations
  // remain available for later review but are never dispatched automatically.
  if(decision.eligible&&typeof key==='string'){seen.add(key);}
  decisions.push(decision);
 }
 checkpoint.processedIds=[...seen].slice(-500);
 return {checkpoint,decisions,output:'DECISION_ONLY',automaticPlaybackEnabled:false};
}
