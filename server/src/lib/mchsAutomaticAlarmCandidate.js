/** Automatic MCHS candidate triage. A mobile notification is not official proof.
 * Every outcome is review-only and cannot actuate Radio Worker.
 */
import {classifyMchsObservation} from './mchsClassification.js';
export function classifyAutomaticAlarmCandidate(event,{nowMs=Date.now(),region='Тульская область'}={}){
 const eventType=classifyMchsObservation(event?.title,event?.body);
 const result={eventId:event?.id||null,eventType,action:'REVIEW_ONLY',executionEnabled:false};
 const reject=reason=>({...result,accepted:false,reason});
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))return reject('EVENT_TYPE_BLOCKED');
 if(event?.source!=='MCHS_ANDROID')return reject('UNKNOWN_SOURCE');
 if(event?.region?.trim().toLocaleLowerCase('ru-RU')!==region.toLocaleLowerCase('ru-RU'))
  return reject('REGION_MISMATCH');
 const timestamp=Date.parse(event?.occurredAt||'');
 if(!Number.isFinite(timestamp)||timestamp>nowMs+30000||nowMs-timestamp>120000)
  return reject('STALE_OR_UNKNOWN_TIMESTAMP');
 if(!event?.sourceEventId)return reject('MISSING_SOURCE_ID');
 // A verified flag from an Android bridge MUST NOT grant official-source authority.
 return {...result,accepted:true,reason:'OFFICIAL_PROVENANCE_REQUIRED',
  mobileObservationVerified:event.verified===true,officialSourceVerified:false};
}
