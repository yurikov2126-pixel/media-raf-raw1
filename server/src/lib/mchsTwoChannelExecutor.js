import {assessMchsDualChannelTransition} from './mchsDualChannelTransition.js';

/** Execute a two-channel session only through explicitly supplied authenticated
 * channel adapters. Not connected to live Android intake or public radio.
 * Caller must provide verified authorization; no implicit fallback.
 */
export async function runMchsTwoChannelExecution({
 event,authorization,worker,agent,signal,now=()=>Date.now(),startTimeoutMs=10000,stopTimeoutMs=5000
}={}){
 const fail=(reason,details={})=>({ok:false,reason,...details,automaticBroadcastEnabled:false});
 if(!authorization||authorization.approved!==true||authorization.mode!=='ISOLATED_TRIAL'||
    authorization.publicStreamAllowed!==false||authorization.amplifierAllowed!==false)
  return fail('TRIAL_AUTHORIZATION_REQUIRED');
 if(!event?.id||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(event.eventType)||
    !event.assetId||!Number.isInteger(event.repeats)||event.repeats<1||event.repeats>5||
    (event.eventType==='MISSILE_ALL_CLEAR'&&event.repeats!==1))
  return fail('INVALID_EVENT');
 const when=Date.parse(event.occurredAt||'');
 if(!Number.isFinite(when)||when>now()||now()-when>120000)return fail('EXPIRED_EVENT');
 if(!worker||!agent||!['start','stop'].every(k=>typeof worker[k]==='function'&&typeof agent[k]==='function'))
  return fail('CHANNEL_ADAPTER_MISSING');
 const spec={eventId:event.id,eventType:event.eventType,assetId:event.assetId,repeats:event.repeats,
  publicStreamAllowed:false,amplifierAllowed:false};
 // Bound each STOP independently. A hanging channel must never block the
 // other channel's STOP or the operator's failure response.
 const boundedStop=channel=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('STOP_TIMEOUT')),stopTimeoutMs);
  Promise.resolve().then(()=>channel.stop(spec)).then(
   value=>{clearTimeout(timer);resolve(value);},
   error=>{clearTimeout(timer);reject(error);}
  );
 });
 const stopBoth=async()=>Promise.allSettled([boundedStop(worker),boundedStop(agent)]);
 const awaitStarts=()=>new Promise(resolve=>{
  let completed=false;
  let timer;
  const done=result=>{
   if(completed)return;
   completed=true;clearTimeout(timer);
   signal?.removeEventListener?.('abort',onAbort);
   resolve(result);
  };
  const onAbort=()=>done({reason:'CANCELLED'});
  signal?.addEventListener?.('abort',onAbort,{once:true});
  timer=setTimeout(()=>done({reason:'START_TIMEOUT'}),startTimeoutMs);
  void Promise.allSettled([
   Promise.resolve().then(()=>worker.start(spec)),
   Promise.resolve().then(()=>agent.start(spec))
  ]).then(results=>done({results}));
  if(signal?.aborted)onAbort();
 });
 if(!Number.isInteger(stopTimeoutMs)||stopTimeoutMs<100||stopTimeoutMs>120000)
  return fail('INVALID_STOP_TIMEOUT');
 if(signal?.aborted)return fail('CANCELLED');
 let starts;
 try{
  // Both are attempted, so a rejected START cannot conceal a concurrent success.
  if(!Number.isInteger(startTimeoutMs)||startTimeoutMs<100||startTimeoutMs>120000)
   return fail('INVALID_START_TIMEOUT');
  const outcome=await awaitStarts();
  if(outcome.reason){
   const stops=await stopBoth();
   return fail(outcome.reason,{stopRequestsSettled:stops.every(x=>x.status==='fulfilled'),
    stopConfirmed:false,requiresOperatorReview:true});
  }
  starts=outcome.results;
  const evidence=assessMchsDualChannelTransition({eventId:event.id,eventType:event.eventType,
   action:'START',worker:starts[0].status==='fulfilled'?starts[0].value:null,
   agent:starts[1].status==='fulfilled'?starts[1].value:null,nowMs:now()});
  if(!evidence.bothConfirmed||signal?.aborted){
   const stops=await stopBoth();
   return fail(signal?.aborted?'CANCELLED':'START_NOT_CONFIRMED',{startEvidence:evidence,
    stopRequestsSettled:stops.every(x=>x.status==='fulfilled'),stopConfirmed:false,requiresOperatorReview:true});
  }
  // This is a bounded handoff; not a playback loop or an endorsement of actual
  // audible emergency warnings. Caller must signal STOP, never auto-resume.
  const stops=await stopBoth();
  const stopEvidence=assessMchsDualChannelTransition({eventId:event.id,eventType:event.eventType,
   action:'STOP',worker:stops[0].status==='fulfilled'?stops[0].value:null,
   agent:stops[1].status==='fulfilled'?stops[1].value:null,nowMs:now()});
  return {ok:stopEvidence.bothConfirmed,reason:stopEvidence.bothConfirmed?'TRIAL_CONFIRMED':'STOP_NOT_CONFIRMED',
   startEvidence:evidence,stopEvidence,automaticBroadcastEnabled:false};
 }catch{
  await stopBoth();
  return fail('EXECUTION_FAILED');
 }
}
