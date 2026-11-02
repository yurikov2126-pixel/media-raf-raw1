import {stopAndVerifyMchsWorker} from './mchsWorkerStopVerification.js';

/** Concrete Worker endpoint adapter. The existing PCM training overlay also feeds
 * public radio: this adapter MUST NOT be attached to automatic public dispatch.
 * The caller supplies verified, operator-controlled transport and isolation.
 */
export function createMchsVerifiedWorkerTransport({request,isolatedOutputVerified=false,
 pollMs=500,trackTimeoutMs=300000,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
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
   if(before?.httpStatus!==200||before.data?.active!==false)return reject('WORKER_BUSY_OR_UNAVAILABLE');
   const start=await request('START',spec.assetId);
   if(start?.httpStatus!==200||start.data?.ok!==true)return reject('START_REJECTED');
   session={...spec,aborted:false,startedAt:now()};
   try{
    const active=await request();
    if(active?.httpStatus!==200||active.data?.active!==true||active.data?.assetId!==spec.assetId)
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
   if(!current||current.eventId!==spec?.eventId)return {completed:false,reason:'SESSION_MISMATCH'};
   try{
    for(let repeat=0;repeat<current.repeats;repeat++){
     const deadline=now()+trackTimeoutMs;
     let complete=false;
     while(now()<deadline&&!current.aborted){
      await sleep(pollMs);
      const state=await request();
      if(state?.httpStatus!==200)throw Error('STATUS_UNAVAILABLE');
      if(state.data?.active===false){
       if(state.data.lastStopReason!=='FILE_COMPLETED')throw Error('UNEXPECTED_STOP');
       complete=true;break;
      }
      if(state.data?.assetId!==current.assetId)throw Error('WRONG_TRACK');
     }
     if(!complete)throw Error(current.aborted?'ABORTED':'TRACK_TIMEOUT');
     if(repeat+1<current.repeats){
      if(current.aborted)throw Error('ABORTED');
      const started=await request('START',current.assetId);
      if(started?.httpStatus!==200||started.data?.ok!==true)throw Error('REPEAT_START_FAILED');
      const active=await request();
      if(active?.httpStatus!==200||active.data?.active!==true||active.data?.assetId!==current.assetId)
       throw Error('REPEAT_NOT_OBSERVED');
     }
    }
    // Natural completion releases the event lock for the next genuine event.
    // STOP remains independently available even after this transition.
    if(session===current)session=null;
    return {completed:true,eventId:current.eventId,repeats:current.repeats};
   }catch(error){
    if(session===current)session=null;
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
