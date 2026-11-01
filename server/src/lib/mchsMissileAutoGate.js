import {classifyMchsObservation} from './mchsClassification.js';

export const MISSILE_AUTO_TYPES=Object.freeze(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
/** Fail-closed event evaluation. A valid decision is NOT a broadcast authorization. */
export function assessMissileAutoEvent(event,{nowMs=Date.now(),seenIds=new Set(),region='Тульская область',rules={}}={}){
 const eventType=classifyMchsObservation(event?.title,event?.body);
 const basic={eventType,eventId:event?.id||null,sourceEventId:event?.sourceEventId||null,
   output:'DECISION_ONLY',automaticPlaybackEnabled:false};
 const blocked=reason=>({...basic,eligible:false,reason,audioAssetId:null});
 if(!MISSILE_AUTO_TYPES.includes(eventType))return blocked('TYPE_NOT_AUTOMATED');
 if(event?.source!=='MCHS_ANDROID')return blocked('UNTRUSTED_SOURCE');
 if(event?.verified!==true)return blocked('NOT_VERIFIED');
 if(typeof event?.sourceEventId!=='string'||!event.sourceEventId)return blocked('MISSING_SOURCE_EVENT_ID');
 if(seenIds.has(event.sourceEventId))return blocked('DUPLICATE');
 if(typeof event?.region!=='string'||event.region.trim().toLocaleLowerCase('ru-RU')!==region.toLocaleLowerCase('ru-RU'))
  return blocked('REGION_UNVERIFIED');
 const occurred=event?.occurredAt?new Date(event.occurredAt).getTime():NaN;
 if(!Number.isFinite(occurred)||occurred>nowMs+30000||nowMs-occurred>120000)return blocked('STALE_OR_UNKNOWN_TIME');
 const rule=rules[eventType];
 if(rule?.mode!=='REVIEW')return blocked('RULE_DISABLED');
 if(typeof rule?.audioAssetId!=='string'||!rule.audioAssetId)return blocked('ALARM_AUDIO_MISSING');
 return {...basic,eligible:true,reason:null,audioAssetId:rule.audioAssetId};
}
/** Enforce missile DANGER -> ALL_CLEAR progression; never synthesize an all-clear. */
export function missileNextState(current,eventType){
 if(current!=='DANGER'&&current!=='CLEAR'&&current!=='UNKNOWN')return {accepted:false,state:'UNKNOWN',reason:'UNKNOWN_STATE'};
 if(eventType==='MISSILE_DANGER')
  return current==='DANGER'?{accepted:false,state:current,reason:'DUPLICATE_DANGER'}:{accepted:true,state:'DANGER',reason:null};
 if(eventType==='MISSILE_ALL_CLEAR')
  return current!=='DANGER'?{accepted:false,state:current,reason:'CLEAR_WITHOUT_DANGER'}:{accepted:true,state:'CLEAR',reason:null};
 return {accepted:false,state:current,reason:'TYPE_NOT_AUTOMATED'};
}
