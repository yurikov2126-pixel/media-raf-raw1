/** In-memory, bounded ALARM overlay session receipts. Only PCM output
 * snapshots (not HTTP START acknowledgement) can mark natural completion.
 * This is the explicitly enabled training transport, NOT public-event authority.
 */
export function createMchsWorkerEventJournal({capacity=100,now=()=>new Date().toISOString()}={}){
 if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw new TypeError('INVALID_JOURNAL_CAPACITY');
 const history=[];let active=null;
 const validText=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
 const copy=r=>r?{...r}:null;
 function begin({eventId,eventType,assetId,repeats,revision,trialOnly}={}){
  if(active)return {ok:false,reason:'SESSION_ACTIVE'};
  if(trialOnly!==true||!validText(eventId)||!validText(assetId)||
     !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType)||
     !Number.isInteger(repeats)||repeats<1||repeats>5||
     (eventType==='MISSILE_ALL_CLEAR'&&repeats!==1)||
     !Number.isSafeInteger(revision)||revision<0)
   return {ok:false,reason:'INVALID_TRIAL_BINDING'};
  if(history.some(e=>e.eventId===eventId))
   return {ok:false,reason:'DUPLICATE_TRIAL_EVENT'};
  active={eventId,eventType,assetId,repeats,startRevision:revision,
   revision,active:true,completedRepeats:0,startedAt:now(),
   completedAt:null,lastStopReason:null,trialOnly:true,
   publicPlaybackAuthorized:false};
  return {ok:true,receipt:copy(active)};
 }
 function observe(snapshot){
  if(!active)return null;
  if(!snapshot||!Number.isSafeInteger(snapshot.revision)||
     !Number.isInteger(snapshot.completedRepeats))return null;
  if(snapshot.active){
   if(snapshot.revision!==active.startRevision||
      snapshot.repeats!==active.repeats||
      snapshot.completedRepeats<active.completedRepeats||
      snapshot.completedRepeats>active.repeats)return null;
   active.completedRepeats=snapshot.completedRepeats;
   return copy(active);
  }
  // Completion is recorded only after the PCM overlay itself is inactive.
  // A partial or aborted file never becomes a successful receipt.
  const finished=snapshot.revision===active.startRevision+1&&
   snapshot.lastStopReason==='FILE_COMPLETED'&&
   snapshot.completedRepeats===active.repeats&&
   snapshot.repeats===active.repeats;
  const receipt={...active,active:false,revision:snapshot.revision,
   completedRepeats:snapshot.completedRepeats,
   lastStopReason:snapshot.lastStopReason||'UNKNOWN',
   completedAt:now(),naturalCompletion:finished};
  history.push(receipt);if(history.length>capacity)history.shift();
  active=null;return copy(receipt);
 }
 function abort(reason='UNKNOWN'){
  if(!active)return null;
  const receipt={...active,active:false,lastStopReason:reason,
   completedAt:now(),naturalCompletion:false};
  history.push(receipt);if(history.length>capacity)history.shift();
  active=null;return copy(receipt);
 }
 return {
  begin,observe,abort,
  current:()=>copy(active),
  last:()=>copy(history.at(-1)),
  // Only a bound test event may be looked up; no generic "latest success".
  get:eventId=>validText(eventId)?copy(history.findLast(x=>x.eventId===eventId)):null,
  recent:()=>history.map(copy)
 };
}
