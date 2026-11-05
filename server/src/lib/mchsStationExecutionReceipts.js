/** Observe Worker PCM phases without confusing an accepted START with audible completion.
 * Receipts are observations, never authorization to broadcast or energize PA.
 */
export const MCHS_STATION_RECEIPTS_KEY='mchs_station_execution_receipts_v1';
export function normalizeStationReceipts(raw){
 const x=raw&&typeof raw==='object'?raw:{};
 return {items:Array.isArray(x.items)?x.items.filter(v=>v&&typeof v.eventId==='string'
  &&v.eventId.length<=128).slice(-200):[],updatedAt:typeof x.updatedAt==='string'?x.updatedAt:null};
}
export function registerStationDispatch(raw,results,{at=new Date().toISOString()}={}){
 const prior=normalizeStationReceipts(raw),items=[...prior.items];
 for(const r of results||[]){
  if(typeof r?.eventId!=='string'||!r.eventId)continue;
  if(items.some(x=>x.eventId===r.eventId))continue;
  const accepted=r.ok===true;
  items.push({eventId:r.eventId,eventType:r.eventType||null,
   state:accepted?'START_ACCEPTED':'START_REJECTED',
   phase:accepted?'PREEMPTING':null,
   startedAt:at,lastObservedAt:at,finishedAt:accepted?null:at,
   preemptAcknowledged:false,naturalCompletion:false,programRestored:false,
   completedRepeats:0,repeats:null,
   reason:accepted?null:r.reason||'WORKER_NOT_CONFIRMED'});
 }
 return {items:items.slice(-200),updatedAt:at};
}
const PHASES=new Set(['PREEMPTING','PLAYING','RESUMING','COMPLETE','FAILED']);
export function reconcileStationReceipts(raw,status,{at=new Date().toISOString()}={}){
 const prior=normalizeStationReceipts(raw);
 if(!status||status.ok!==true||!status.data||!PHASES.has(status.data.phase))
  return {ledger:prior,changed:false,reason:'STATUS_UNAVAILABLE'};
 const snap=status.data,session=snap.session;
 if(!session||typeof session.eventId!=='string')
  return {ledger:prior,changed:false,reason:'SESSION_NOT_AVAILABLE'};
 let changed=false;
 const items=prior.items.map(row=>{
  if(row.eventId!==session.eventId||row.finishedAt)return row;
  const last=row.phase;
  // Never move a session backwards if a delayed snapshot arrives.
  const rank={PREEMPTING:0,PLAYING:1,RESUMING:2,COMPLETE:3,FAILED:3};
  if(last&&rank[snap.phase]<rank[last])return row;
  const natural=snap.phase==='COMPLETE'&&
    session.naturalCompletion===true&&session.programRestored===true&&
    session.preemptAcknowledged===true&&session.completedRepeats===session.repeats;
  const state=snap.phase==='COMPLETE'?
    (natural?'COMPLETE':'INCOMPLETE_EVIDENCE'):snap.phase;
  const next={...row,state,phase:snap.phase,lastObservedAt:at,
   preemptAcknowledged:session.preemptAcknowledged===true,
   naturalCompletion:session.naturalCompletion===true,
   programRestored:session.programRestored===true,
   completedRepeats:Number.isInteger(session.completedRepeats)?session.completedRepeats:0,
   repeats:Number.isInteger(session.repeats)?session.repeats:null,
   finishedAt:['COMPLETE','FAILED'].includes(snap.phase)?at:null,
   reason:snap.phase==='FAILED'?session.failure||'STATION_FAILED':
    state==='INCOMPLETE_EVIDENCE'?'INCOMPLETE_PCM_EVIDENCE':null};
  if(JSON.stringify(next)!==JSON.stringify(row))changed=true;
  return next;
 });
 return {ledger:{items,updatedAt:changed?at:prior.updatedAt},changed,reason:null};
}

/** Match every short-lived terminal event before inspecting current Worker phase.
 * The Worker ring is volatile; only matched API receipts are persisted.
 */
export function reconcileStationReceiptHistory(raw,status,{at=new Date().toISOString()}={}){
 let ledger=normalizeStationReceipts(raw),changed=false;
 if(!status||status.ok!==true||!status.data)
  return {ledger,changed:false,reason:'STATUS_UNAVAILABLE'};
 if(status.data.terminalJournal?.healthy===false)
  return {ledger,changed:false,reason:'WORKER_TERMINAL_JOURNAL_UNHEALTHY'};
 const entries=Array.isArray(status.data.terminalHistory)?
  status.data.terminalHistory.slice(-128):[];
 for(const entry of entries){
  if(!entry||!['COMPLETE','FAILED'].includes(entry.phase)||
     typeof entry.eventId!=='string')continue;
  const result=reconcileStationReceipts(ledger,{
   ok:true,data:{phase:entry.phase,session:entry}},{at});
  ledger=result.ledger;
  changed=changed||result.changed;
 }
 const current=reconcileStationReceipts(ledger,status,{at});
 return {ledger:current.ledger,changed:changed||current.changed,reason:null};
}
