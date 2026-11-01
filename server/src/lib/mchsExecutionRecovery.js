import {recoverExecutionJournal,normalizeExecutionJournal} from './mchsExecutionJournal.js';

/** Pure startup reconciliation. It never resumes or starts ALARM. */
export function reconcilePersistedAlarmAfterRestart(saved){
 const before=normalizeExecutionJournal(saved);
 const after=recoverExecutionJournal(before);
 return {beforeState:before.state,journal:after,
  changed:before.state!==after.state,
  requiresOperatorReview:['INTERRUPTED','HALTED'].includes(after.state),
  dispatchAuthorized:false,automaticPlaybackEnabled:false};
}

/** Stable, bounded idempotency registry. Never accept an event twice. */
export const MCHS_SEEN_EVENT_IDS_KEY='mchs_android_event_ids_v1';
export function normalizeSeenEventIds(raw){
 return Array.isArray(raw)?raw.filter(x=>typeof x==='string'&&x.length>0&&x.length<=200).slice(-500):[];
}
export function recordAndroidEventId(raw,id){
 const seen=normalizeSeenEventIds(raw);
 if(typeof id!=='string'||!id||id.length>200)return {accepted:false,reason:'INVALID_EVENT_ID',seen};
 if(seen.includes(id))return {accepted:false,reason:'DUPLICATE_EVENT',seen};
 return {accepted:true,reason:null,seen:[...seen,id].slice(-500)};
}
