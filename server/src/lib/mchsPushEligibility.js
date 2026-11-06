import {classifyMchsObservation,MCHS_EVENT_TYPES} from './mchsClassification.js';

export const MCHS_PUSH_TYPES=new Set(MCHS_EVENT_TYPES.map(x=>x.id));
export const MCHS_PUSH_MAX_AGE_MS=120000;

const TITLES=Object.fromEntries(MCHS_EVENT_TYPES.map(x=>[x.id,x.label]));

/**
 * Web/FCM notifications are independent of the station's audio queue.
 * HMAC is checked by the ingest route BEFORE this predicate is invoked.
 * A signed Android bridge message still is not independent official verification.
 */
export function assessMchsPushCandidate(input,{allowedChannels=[],nowMs=Date.now()}={}){
 const type=classifyMchsObservation(input?.title,input?.body);
 const rejected=reason=>({eligible:false,type,reason});
 if(!MCHS_PUSH_TYPES.has(type))return rejected('UNRECOGNIZED_TYPE');
 if(!Array.isArray(allowedChannels)||!allowedChannels.length)return rejected('NO_TRUSTED_CHANNEL');
 if(typeof input?.channelId!=='string'||!allowedChannels.includes(input.channelId))
  return rejected('CHANNEL_NOT_ALLOWLISTED');
 if(typeof input?.region!=='string'||
  input.region.trim().toLocaleLowerCase('ru-RU')!=='тульская область')
  return rejected('REGION_MISMATCH');
 const occurred=Date.parse(input?.occurredAt||'');
 if(!Number.isFinite(occurred)||occurred>nowMs+30000||nowMs-occurred>MCHS_PUSH_MAX_AGE_MS)
  return rejected('STALE_OR_UNKNOWN_TIME');
 if(typeof input?.eventId!=='string'||!input.eventId)return rejected('MISSING_EVENT_ID');
 return {eligible:true,type,reason:null};
}

/** Use the classified title; never invent additional hazard categories. */
export function buildMchsPushPayload({type,eventId,body}={}){
 if(!MCHS_PUSH_TYPES.has(type)||typeof eventId!=='string'||!eventId)
  throw new TypeError('INVALID_MCHS_PUSH_EVENT');
 const clean=typeof body==='string'?body.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim():'';
 return {
  title:TITLES[type],
  body:clean.slice(0,220)||'Тульская область · Получено уведомление Android',
  url:'/app',
  tag:'mchs-'+eventId,
  requireInteraction:type.endsWith('_DANGER')
 };
}
