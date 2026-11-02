import {stopAndVerifyMchsWorker} from './mchsWorkerStopVerification.js';

/** Real Worker state verification, never accepts HTTP 200 alone as playback evidence.
 * This module can be called only by an authorized controller; it does not
 * subscribe to Android events or activate automatic public broadcasts.
 */
export async function startAndVerifyMchsWorker({request,assetId,eventId,eventType}={}){
 if(typeof request!=='function'||typeof assetId!=='string'||!assetId||
    typeof eventId!=='string'||!eventId||
    !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))
  return {confirmed:false,reason:'INVALID_START_REQUEST',eventId:eventId||null};
 let attempted=false;
 try{
  const before=await request();
  if(before?.httpStatus!==200||before?.data?.active!==false)
   return {confirmed:false,reason:'WORKER_NOT_IDLE',eventId};
  attempted=true;
  const started=await request('START',assetId);
  if(started?.httpStatus!==200||started?.data?.ok!==true)
   throw new Error('START_REJECTED');
  const current=await request();
  if(current?.httpStatus===200&&current?.data?.active===true&&current?.data?.assetId===assetId)
   return {confirmed:true,reason:'WORKER_OVERLAY_ACTIVE',eventId,eventType,assetId,
    audibleOutputVerified:false};
  throw new Error('START_NOT_OBSERVED');
 }catch(error){
  const stopped=attempted?await stopAndVerifyMchsWorker({request}):null;
  return {confirmed:false,reason:error.message||'WORKER_UNREACHABLE',eventId,
   stopConfirmed:stopped?.confirmed??null,audibleOutputVerified:false};
 }
}
export async function stopMchsWorkerEvent({request,eventId,eventType}={}){
 if(!eventId||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))
  return {confirmed:false,reason:'INVALID_STOP_REQUEST'};
 const result=await stopAndVerifyMchsWorker({request});
 return {eventId,eventType,...result,audibleOutputVerified:false};
}
