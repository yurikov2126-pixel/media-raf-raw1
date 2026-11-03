import {stopAndVerifyMchsWorker} from './mchsWorkerStopVerification.js';

/** One event = one complete PCM overlay session, with bounded full-file repeats.
 * The current endpoint feeds the shared station encoder, therefore this
 * adapter is NEVER authorized to automatically dispatch public alerts.
 */
export function createMchsVerifiedWorkerTransport({
 request,isolatedOutputVerified=false,pollMs=500,trackTimeoutMs=300000,
 now=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 if(typeof request!=='function')throw new TypeError('WORKER_REQUEST_REQUIRED');
 let session=null;
 const reject=reason=>({confirmed:false,reason});
 return {
  async start(spec){
   if(!isolatedOutputVerified)return reject('OUTPUT_ISOLATION_NOT_VERIFIED');
   if(session)return reject('SESSION_ALREADY_RUNNING');
   if(!spec?.eventId||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(spec.eventType)||
    !spec.assetId||!Number.isInteger(spec.repeats)||spec.repeats<1||spec.repeats>5||
    (spec.eventType==='MISSILE_ALL_CLEAR'&&spec.repeats!==1)||
    spec.publicStreamAllowed!==false||spec.amplifierAllowed!==false)
    return reject('INVALID_SESSION');
   const before=await request();
   if(before?.httpStatus!==200||before.data?.active!==false)
    return reject('WORKER_BUSY_OR_UNAVAILABLE');
   // The Worker owns all repetitions. Never issue a second START for a repeat:
   // that would release the station mixer and leak music between repetitions.
   const start=await request('START',spec.assetId,spec.repeats);
   if(start?.httpStatus!==200||start.data?.ok!==true||
      !Number.isInteger(start.data?.revision))
    return reject('START_REJECTED_OR_REVISION_MISSING');
   session={...spec,revision:start.data.revision,aborted:false,
    startedAt:now(),completedRepeats:0};
   try{
    const active=await request();
    if(active?.httpStatus!==200||active.data?.active!==true||
       active.data?.assetId!==spec.assetId||
       active.data?.revision!==session.revision||
       active.data?.repeats!==spec.repeats)
     throw Error('START_UNCONFIRMED');
    return {eventId:spec.eventId,eventType:spec.eventType,action:'START',
     confirmed:true,playbackState:'ACTIVE',confirmedAt:new Date(now()).toISOString()};
   }catch(error){
    session.aborted=true;
    await stopAndVerifyMchsWorker({request});
    session=null;
    return reject(error.message||'START_UNCONFIRMED');
   }
  },
  async waitUntilCompleted(spec){
   const current=session;
   if(!current||current.eventId!==spec?.eventId||
      current.assetId!==spec.assetId||current.repeats!==spec.repeats)
    return {completed:false,reason:'SESSION_MISMATCH'};
   try{
    const deadline=now()+trackTimeoutMs;
    while(now()<deadline&&!current.aborted){
     await sleep(pollMs);
     const state=await request();
     if(state?.httpStatus!==200)throw Error('STATUS_UNAVAILABLE');
     const snapshot=state.data;
     if(!snapshot||!Number.isInteger(snapshot.revision))
      throw Error('REVISION_UNAVAILABLE');
     if(snapshot.active===true){
      if(snapshot.revision!==current.revision)throw Error('SESSION_CHANGED');
      if(snapshot.assetId!==current.assetId||snapshot.repeats!==current.repeats)
       throw Error('WRONG_TRACK_OR_REPEAT_COUNT');
      if(!Number.isInteger(snapshot.completedRepeats)||
         snapshot.completedRepeats<current.completedRepeats||
         snapshot.completedRepeats>current.repeats)
       throw Error('INVALID_REPEAT_PROGRESS');
      current.completedRepeats=snapshot.completedRepeats;
      continue;
     }
     if(snapshot.active!==false||
        snapshot.revision!==current.revision+1||
        snapshot.lastStopReason!=='FILE_COMPLETED'||
        snapshot.completedRepeats!==current.repeats||
        snapshot.repeats!==current.repeats)
      throw Error('INCOMPLETE_OR_FOREIGN_SESSION');
     if(session===current)session=null;
     return {completed:true,eventId:current.eventId,repeats:current.repeats,
      reason:'FILE_COMPLETED'};
    }
    throw Error(current.aborted?'ABORTED':'TRACK_TIMEOUT');
   }catch(error){
    // Keep the session locked on failure. The caller must stop and verify
    // the actual Worker overlay before accepting another event.
    return {completed:false,reason:error.message||'WORKER_FAILED'};
   }
  },
  async stop(spec){
   if(session)session.aborted=true;
   if(!isolatedOutputVerified)return {...reject('OUTPUT_ISOLATION_NOT_VERIFIED'),action:'STOP'};
   const result=await stopAndVerifyMchsWorker({request});
   if(result.confirmed)session=null;
   return {eventId:spec?.eventId||null,eventType:spec?.eventType||null,
    action:'STOP',confirmed:result.confirmed===true,
    playbackState:result.confirmed?'STOPPED':'UNKNOWN',
    reason:result.reason,confirmedAt:new Date(now()).toISOString()};
  }
 };
}
