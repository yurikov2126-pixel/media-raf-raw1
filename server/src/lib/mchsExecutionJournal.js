/** Persistable, bounded execution state. No stored record grants loudspeaker authority. */
export const MCHS_EXECUTION_JOURNAL_KEY='mchs_execution_journal_v1';
export const MCHS_EXECUTION_STATES=Object.freeze(['IDLE','DANGER_PENDING','DANGER_ACTIVE','CLEAR_PENDING','HALTED','INTERRUPTED']);
export function normalizeExecutionJournal(raw){
 const value=raw&&typeof raw==='object'?raw:{};
 const state=MCHS_EXECUTION_STATES.includes(value.state)?value.state:'HALTED';
 const entries=Array.isArray(value.entries)?value.entries.slice(-50).filter(x=>x&&typeof x==='object')
  .map(x=>({at:typeof x.at==='string'?x.at:null,action:String(x.action||'UNKNOWN').slice(0,60),
   reason:String(x.reason||'').slice(0,120)})):[];
 return {state,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:null,entries,
  executionEnabled:false,automaticPlaybackEnabled:false};
}
export function appendExecutionJournal(raw,{action,reason='',at=new Date().toISOString()}={}){
 const current=normalizeExecutionJournal(raw);
 return {...current,updatedAt:at,entries:[...current.entries,{at,action:String(action||'UNKNOWN').slice(0,60),
  reason:String(reason).slice(0,120)}].slice(-50),executionEnabled:false,automaticPlaybackEnabled:false};
}
export function recoverExecutionJournal(raw){
 const current=normalizeExecutionJournal(raw);
 // Do not assume previous PCM activity survived API or worker restart.
 if(['DANGER_PENDING','DANGER_ACTIVE','CLEAR_PENDING'].includes(current.state))
  return appendExecutionJournal({...current,state:'INTERRUPTED'},{
   action:'RECOVERY_HOLD',reason:'EXECUTION_STATE_UNCERTAIN_AFTER_RESTART'});
 return current;
}
