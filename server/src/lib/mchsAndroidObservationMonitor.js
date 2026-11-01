import {classifyAutomaticAlarmCandidate} from './mchsAutomaticAlarmCandidate.js';

export const MCHS_MONITOR_KEY='mchs_android_monitor_v1';
export function normalizeAndroidMonitor(raw){
 const x=raw&&typeof raw==='object'?raw:{};
 return {seenIds:Array.isArray(x.seenIds)?x.seenIds.filter(id=>typeof id==='string'&&id.length>0&&id.length<=200).slice(-500):[],
  entries:Array.isArray(x.entries)?x.entries.filter(e=>e&&typeof e==='object').slice(-100):[],
  checkedAt:typeof x.checkedAt==='string'?x.checkedAt:null};
}
/** Observe incoming messages, retaining decisions across API restarts. No PCM commands. */
export function observeAndroidEvents(raw,events,{nowMs=Date.now()}={}){
 const state=normalizeAndroidMonitor(raw),seen=new Set(state.seenIds),entries=[...state.entries],newEntries=[];
 for(const event of [...events].sort((a,b)=>Date.parse(a.occurredAt||0)-Date.parse(b.occurredAt||0))){
  const id=event?.sourceEventId;
  if(typeof id!=='string'||!id||id.length>200||seen.has(id))continue;
  const verdict=classifyAutomaticAlarmCandidate(event,{nowMs});
  const entry={eventId:event.id,sourceEventId:id,eventType:verdict.eventType,
   result:verdict.accepted?'OBSERVED':'REJECTED',reason:verdict.reason,
   checkedAt:new Date(nowMs).toISOString()};
  seen.add(id);entries.push(entry);newEntries.push(entry);
 }
 return {state:{seenIds:[...seen].slice(-500),entries:entries.slice(-100),
  checkedAt:new Date(nowMs).toISOString()},newEntries,dispatchAuthorized:false,
  automaticPlaybackEnabled:false};
}
