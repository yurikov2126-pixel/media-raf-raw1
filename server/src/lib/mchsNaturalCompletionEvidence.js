/** Non-actuating correlation of the same ALARM event across Worker and Agent.
 * Worker transport status is not event-bound by default: an asset match alone
 * must never be interpreted as confirmation of a real emergency announcement.
 */
export function assessMchsNaturalCompletion({
 intent,worker,agent,nowMs=Date.now(),maxAgeMs=60000
}={}){
 const holds=[];
 const validType=['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(intent?.eventType);
 const expected=intent?.repetitions;
 if(!intent||typeof intent.eventId!=='string'||!intent.eventId||
    !validType||typeof intent.assetId!=='string'||!intent.assetId||
    !Number.isInteger(expected)||expected<1||expected>5||
    (intent.eventType==='MISSILE_ALL_CLEAR'&&expected!==1))
  holds.push('INVALID_INTENT');
 const timestamp=(channel,value)=>{
  const at=Date.parse(value?.completedAt||value?.reportedAt||'');
  if(!Number.isFinite(at)||at>nowMs||nowMs-at>maxAgeMs){
   holds.push(channel+'_STALE_OR_MISSING_TIME');return false;
  }
  return true;
 };
 const workerTime=timestamp('WORKER',worker);
 if(!worker||worker.eventId!==intent?.eventId||worker.eventType!==intent?.eventType||
    worker.assetId!==intent?.assetId){
  holds.push('WORKER_EVENT_NOT_BOUND');
 }
 if(worker?.active!==false||worker?.lastStopReason!=='FILE_COMPLETED'||
    worker?.completedRepeats!==expected||worker?.repeats!==expected)
  holds.push('WORKER_NOT_NATURALLY_COMPLETED');
 // Require an event-scoped receipt identifying the exact successful Worker
 // session. An ordinary status read from the shared station encoder has no
 // eventId and therefore cannot satisfy this requirement.
 if(!Number.isSafeInteger(worker?.startRevision)||worker.startRevision<0||
    worker?.revision!==worker.startRevision+1)
  holds.push('WORKER_SESSION_NOT_PROVEN');
 const agentTime=timestamp('AGENT',agent);
 if(!agent||agent.version!==2||agent.eventId!==intent?.eventId)
  holds.push('AGENT_EVENT_NOT_BOUND');
 if(agent?.state!=='COMPLETED'||agent?.localNaturalCompletionObserved!==true||
    agent?.completedRepeats!==expected||agent?.expectedRepeats!==expected||
    agent?.processRunning!==false||agent?.failureReason!==null)
  holds.push('AGENT_NOT_NATURALLY_COMPLETED');
 const workerComplete=workerTime&&!holds.some(h=>h.startsWith('WORKER_'))&&!holds.includes('INVALID_INTENT');
 const agentComplete=agentTime&&!holds.some(h=>h.startsWith('AGENT_'))&&!holds.includes('INVALID_INTENT');
 return {eventId:intent?.eventId||null,eventType:intent?.eventType||null,
  workerComplete,agentComplete,bothNaturallyCompleted:workerComplete&&agentComplete,
  holds:[...new Set(holds)],output:'READ_ONLY_COMPLETION_CORRELATION',
  publicPlaybackAuthorized:false,automaticDispatchEnabled:false,
  physicalAudibilityVerified:false};
}
