import {stopAndVerifyMchsWorker} from './mchsWorkerStopVerification.js';
/** Real PCM Worker transport for operator-authorized isolated acceptance.
 * Do not connect this adapter to public automatic emergency dispatch.
 */
export function createMchsWorkerAlarmAdapter({request,pollMs=500,maxTrackMs=300000,isolatedOutputVerified=false}={}){
 if(typeof request!=='function')throw new Error('WORKER_TRANSPORT_REQUIRED');
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let owner=null,abort=false;
 return {
  async start(spec){
   if(!isolatedOutputVerified)return {confirmed:false,reason:'PUBLIC_OUTPUT_NOT_ISOLATED'};
   if(owner)return {confirmed:false,reason:'BUSY'};
   if(!spec?.eventId||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(spec.eventType)||
      !spec.assetId||!Number.isInteger(spec.repeats)||spec.repeats<1||spec.repeats>5||
      (spec.eventType==='MISSILE_ALL_CLEAR'&&spec.repeats!==1)||
      spec.publicStreamAllowed!==false||spec.amplifierAllowed!==false)
    return {confirmed:false,reason:'INVALID_OR_NONISOLATED_REQUEST'};
   const initial=await request();
   if(initial?.httpStatus!==200||initial.data?.active!==false)
    return {confirmed:false,reason:'WORKER_NOT_IDLE'};
   owner=spec.eventId;abort=false;
   try{
    for(let n=0;n<spec.repeats;n++){
     if(abort)throw Error('STOP_REQUESTED');
     const started=await request('START',spec.assetId);
     if(started.httpStatus!==200||started.data?.ok!==true)throw Error('START_REJECTED');
     const state=await request();
     if(state.httpStatus!==200||state.data?.active!==true||state.data?.assetId!==spec.assetId)
      throw Error('START_NOT_CONFIRMED');
     const deadline=Date.now()+maxTrackMs;
     let complete=false;
     while(Date.now()<deadline&&!abort){
      await sleep(pollMs);
      const status=await request();
      if(status?.httpStatus!==200)throw Error('STATUS_UNAVAILABLE');
      if(status.data?.active===false){
       if(status.data.lastStopReason!=='FILE_COMPLETED')throw Error('UNEXPECTED_STOP');
       complete=true;break;
      }
     }
     if(!complete)throw Error(abort?'STOP_REQUESTED':'PLAYBACK_TIMEOUT');
    }
    return {confirmed:true,eventId:spec.eventId,eventType:spec.eventType,
     action:'START',playbackState:'ACTIVE',completed:true,repeats:spec.repeats,
     confirmedAt:new Date().toISOString(),audibleOutputVerified:false};
   }catch(error){
    await stopAndVerifyMchsWorker({request});
    return {confirmed:false,reason:error.message||'PLAYBACK_FAILED'};
   }finally{owner=null;}
  },
  async stop(spec){
   abort=true;
   const state=isolatedOutputVerified?await stopAndVerifyMchsWorker({request}):
    {confirmed:false,reason:'PUBLIC_OUTPUT_NOT_ISOLATED'};
   return {eventId:spec?.eventId,eventType:spec?.eventType,action:'STOP',
    confirmed:state.confirmed===true,playbackState:state.confirmed?'STOPPED':'UNKNOWN',
    confirmedAt:new Date().toISOString(),reason:state.reason};
  }
 };
}
