/**
 * Validate the internal, event-bound main-station request before a single
 * byte of PCM can be admitted to the priority encoder.
 * This function never authorizes an Android source or public output.
 */
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const TYPES=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);

export function validateMchsStationCommand(command,{nowMs=Date.now()}={}){
 if(!command||typeof command!=='object'||Array.isArray(command))
  return {ok:false,reason:'INVALID_COMMAND'};
 const {action,eventId,eventType,assetId,repeats,occurredAt}=command;
 if(action==='STATUS')return {ok:true,action};
 if(action==='STOP'){
  if(typeof eventId!=='string'||!ID.test(eventId))
   return {ok:false,reason:'INVALID_STOP_EVENT_ID'};
  return {ok:true,action,eventId};
 }
 if(action!=='START')return {ok:false,reason:'UNSUPPORTED_ACTION'};
 if(typeof eventId!=='string'||!ID.test(eventId)||
    typeof assetId!=='string'||!ID.test(assetId)||
    !TYPES.has(eventType)||!Number.isInteger(repeats)||repeats<1||
    repeats>5||(eventType==='MISSILE_ALL_CLEAR'&&repeats!==1))
  return {ok:false,reason:'INVALID_EVENT_BINDING'};
 if(typeof occurredAt!=='string')return {ok:false,reason:'INVALID_EVENT_TIME'};
 const issued=Date.parse(occurredAt);
 if(!Number.isFinite(issued)||issued>nowMs+5000||nowMs-issued>120000)
  return {ok:false,reason:'EVENT_NOT_FRESH'};
 return {ok:true,action,eventId,eventType,assetId,repeats,occurredAt};
}
