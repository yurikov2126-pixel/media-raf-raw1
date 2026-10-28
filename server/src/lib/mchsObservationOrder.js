import { classifyMchsObservation } from './mchsClassification.js';

const FAMILY={UAV_DANGER:'UAV',UAV_ALL_CLEAR:'UAV',MISSILE_DANGER:'MISSILE',MISSILE_ALL_CLEAR:'MISSILE'};
const DANGER=new Set(['UAV_DANGER','MISSILE_DANGER']);
const CLEAR=new Set(['UAV_ALL_CLEAR','MISSILE_ALL_CLEAR']);

/** Historic observation analysis only; does not establish the official alert state. */
export function inspectMchsObservationOrder(events=[],{nowMs=Date.now()}={}) {
 const open={UAV:null,MISSILE:null};
 const seen=new Set();
 return [...events].sort((a,b)=>{
   const ta=Date.parse(a?.occurredAt||a?.receivedAt||'')||0;
   const tb=Date.parse(b?.occurredAt||b?.receivedAt||'')||0;
   return ta-tb||String(a?.id||'').localeCompare(String(b?.id||''));
 }).map(e=>{
   const type=classifyMchsObservation(e?.title,e?.body);
   const family=FAMILY[type]||null;
   const key=String(e?.source||'MCHS_ANDROID')+':'+String(e?.sourceEventId||'');
   const occurred=Date.parse(e?.occurredAt||'');
   const ageMs=Number.isFinite(occurred)?nowMs-occurred:null;
   let diagnosis='UNKNOWN_TYPE';
   if(!e?.sourceEventId||seen.has(key)) diagnosis='DUPLICATE_OR_MISSING_ID';
   else if(!family) diagnosis='UNKNOWN_TYPE';
   else if(!Number.isFinite(occurred)) diagnosis='UNKNOWN_TIME';
   else if(ageMs< -120000) diagnosis='FUTURE_TIME';
   else if(DANGER.has(type)) {
     diagnosis=open[family]?'REPEATED_DANGER':'DANGER_OBSERVED';
     open[family]={id:e.id||null,sourceEventId:e.sourceEventId,occurredAt:e.occurredAt};
   } else if(CLEAR.has(type)) {
     diagnosis=open[family]?'MATCHED_ALL_CLEAR':'UNMATCHED_ALL_CLEAR';
     if(open[family]) open[family]=null;
   }
   if(e?.sourceEventId)seen.add(key);
   return {eventId:e?.id||null,sourceEventId:e?.sourceEventId||null,eventType:type,
     family,diagnosis,ageMs,sourceVerified:false,officialState:'UNKNOWN',
     playbackEnabled:false};
 });
}
