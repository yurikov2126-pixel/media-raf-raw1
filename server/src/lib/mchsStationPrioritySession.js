/**
 * Event-bound priority session model for the future primary station encoder.
 *
 * No import of the Worker, HTTP server, GPIO driver or Android ingest: this
 * is a pure lifecycle model to verify the handoff contract before live wiring.
 * Snapshots are observations, not permission to invoke any output.
 */
const EVENT_TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
const PHASES=new Set(['IDLE','PREEMPTING','PLAYING','RESUMING','COMPLETE','FAILED']);
const IDENTIFIER=/^[a-zA-Z0-9_-]{1,128}$/;
const clone=value=>value?{...value}:null;

export function createMchsStationPrioritySession({historyLimit=128}={}){
 if(!Number.isInteger(historyLimit)||historyLimit<1||historyLimit>1024)
  throw new TypeError('INVALID_HISTORY_LIMIT');
 let phase='IDLE',current=null;
 const seen=new Set();
 const completed=[];
 const deny=reason=>({accepted:false,reason,phase});
 const succeed=(reason='OK')=>({accepted:true,reason,phase});
 const publicSnapshot=()=>({
  phase,session:clone(current),last:clone(completed.at(-1)),
  readyForLiveDispatch:false,liveDispatchAuthorized:false,
  publicRadioEnabled:false,amplifierEnabled:false
 });
 function enter(event){
  if(phase!=='IDLE'&&phase!=='COMPLETE'&&phase!=='FAILED')
   return deny('PRIORITY_SESSION_ACTIVE');
  if(!event||!IDENTIFIER.test(event.eventId||'')||
    !IDENTIFIER.test(event.assetId||'')||
    !EVENT_TYPES.has(event.eventType)||
    !Number.isInteger(event.repeats)||event.repeats<1||event.repeats>5||
    (event.eventType==='MISSILE_ALL_CLEAR'&&event.repeats!==1))
   return deny('INVALID_EVENT_BINDING');
  if(seen.has(event.eventId))return deny('REPLAYED_EVENT');
  seen.add(event.eventId);
  current={eventId:event.eventId,eventType:event.eventType,
    assetId:event.assetId,repeats:event.repeats,
    completedRepeats:0,preemptAcknowledged:false,
    naturalCompletion:false,programRestored:false,failure:null};
  phase='PREEMPTING';
  return succeed('WAIT_STATION_PREEMPT_ACK');
 }
 function preempted({eventId,sourceSuspended}={}){
  if(phase!=='PREEMPTING'||eventId!==current?.eventId)
   return deny('UNEXPECTED_PREEMPT_ACK');
  if(sourceSuspended!==true)
   return abort('STATION_PREEMPT_NOT_CONFIRMED');
  current.preemptAcknowledged=true;
  phase='PLAYING';
  return succeed('PCM_SESSION_READY');
 }
 function frameCompleted({eventId,repeats,reason}={}){
  if(phase!=='PLAYING'||eventId!==current?.eventId)
   return deny('UNEXPECTED_PCM_COMPLETION');
  if(reason!=='FILE_COMPLETED'||repeats!==current.repeats)
   return abort('PCM_NOT_NATURALLY_COMPLETED');
  current.completedRepeats=repeats;
  current.naturalCompletion=true;
  phase='RESUMING';
  return succeed('WAIT_STATION_RESUME_ACK');
 }
 function restored({eventId,programAudioConfirmed}={}){
  if(phase!=='RESUMING'||eventId!==current?.eventId)
   return deny('UNEXPECTED_STATION_RESUME_ACK');
  if(programAudioConfirmed!==true)
   return abort('STATION_RESUME_NOT_CONFIRMED');
  current.programRestored=true;
  phase='COMPLETE';
  completed.push({...current,phase:'COMPLETE'});
  if(completed.length>historyLimit)completed.shift();
  return succeed('NATURAL_COMPLETION_AND_PROGRAM_RETURN');
 }
 function abort(reason='ABORTED'){
  if(!current||!['PREEMPTING','PLAYING','RESUMING'].includes(phase))
   return deny('NO_ACTIVE_SESSION');
  current.failure=typeof reason==='string'?reason.slice(0,96):'ABORTED';
  phase='FAILED';
  completed.push({...current,phase:'FAILED'});
  if(completed.length>historyLimit)completed.shift();
  return succeed('SESSION_FAILED_REQUIRES_RECOVERY');
 }
 return {
  enter,preempted,frameCompleted,restored,abort,
  snapshot:publicSnapshot,
  history:()=>completed.map(clone),
  // A proposed next stage must start with a different eventId.
  phases:[...PHASES]
 };
}
