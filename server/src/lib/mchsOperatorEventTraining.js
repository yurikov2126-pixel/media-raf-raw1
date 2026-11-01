import {classifyMchsObservation} from './mchsClassification.js';
/** Only previously stored Android observations may be used in operator-initiated TRAINING. */
export function assessOperatorTrainingEvent(event,{nowMs=Date.now()}={}){
 const type=classifyMchsObservation(event?.title,event?.body);
 if(!event||event.source!=='MCHS_ANDROID')return {allowed:false,reason:'NOT_ANDROID_MCHS'};
 if(event.verified!==true)return {allowed:false,reason:'NOT_VERIFIED'};
 if(type!=='MISSILE_DANGER')return {allowed:false,reason:'NOT_DANGER_EVENT'};
 if(event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область')return {allowed:false,reason:'REGION_MISMATCH'};
 const at=Date.parse(event.occurredAt||'');
 if(!Number.isFinite(at)||at>nowMs+30000||nowMs-at>120000)return {allowed:false,reason:'STALE_EVENT'};
 return {allowed:true,reason:null,type};
}
