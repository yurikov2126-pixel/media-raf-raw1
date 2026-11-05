import {validateMchsStationCommand} from './mchsStationCommandContract.js';

/**
 * Bridges *newly persisted* Android alarm bindings to the priority station.
 * The caller must commit its durable deduplication ledger before invoking this.
 * No retries of stale observations; no Android-facing START endpoint.
 */
export async function dispatchNewAndroidStationBindings({
  intents=[],observations=[],enabled=false,request,nowMs=Date.now(),
}={}){
 const results=[];
 if(!enabled)return {enabled:false,results,reason:'ANDROID_STATION_DISPATCH_DISABLED'};
 if(typeof request!=='function')return {enabled:true,results,reason:'TRANSPORT_MISSING'};
 const byId=new Map(observations.map(o=>[o?.id,o]));
 for(const item of intents){
  const event=byId.get(item?.eventId);
  const reject=(reason)=>results.push({eventId:item?.eventId||null,
    eventType:item?.eventType||null,ok:false,reason});
  if(!event||event.source!=='MCHS_ANDROID'||event.verified!==true||
      event.sourceEventId!==item.sourceEventId||
      event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область'){
   reject('ANDROID_BINDING_MISMATCH');continue;
  }
  if(item.status!=='STAGED'||item.dispatchAuthorized!==false||
      item.officialSourceVerified!==false){
   reject('INVALID_STAGED_BINDING');continue;
  }
  const command={action:'START',eventId:item.eventId,eventType:item.eventType,
   assetId:item.assetId,repeats:item.repetitions,
   occurredAt:new Date(event.occurredAt).toISOString(),
   ...(typeof item.createdAt==='string'?{admittedAt:item.createdAt}:{})};
  const validated=validateMchsStationCommand(command,{nowMs});
  if(!validated.ok){reject(validated.reason);continue;}
  try{
   const response=await request(command);
   results.push({eventId:item.eventId,eventType:item.eventType,
    ok:response?.ok===true,httpStatus:response?.httpStatus||null,reason:response?.ok===true?null:
      response?.data?.reason||response?.reason||'WORKER_NOT_CONFIRMED',
    workerStatus:response?.data?.status||null});
  }catch(error){
   results.push({eventId:item.eventId,eventType:item.eventType,ok:false,
    reason:error?.code||'WORKER_TRANSPORT_ERROR'});
  }
 }
 return {enabled:true,results};
}
