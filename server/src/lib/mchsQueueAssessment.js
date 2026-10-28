import { classifyMchsObservation } from './mchsClassification.js';

/** Observational diagnostic only: never verifies threats or requests playout. */
export function assessMchsQueueObservation(event,{nowMs=Date.now()}={}) {
 const type=classifyMchsObservation(event?.title,event?.body);
 const ts=event?.occurredAt?new Date(event.occurredAt).getTime():NaN;
 const ageMs=Number.isFinite(ts)?nowMs-ts:null;
 let reason='CLASSIFIED_UNVERIFIED';
 if(type==='UNCLASSIFIED')reason='UNCLASSIFIED';
 else if(ageMs===null)reason='UNKNOWN_TIME';
 else if(ageMs< -120000)reason='FUTURE_TIME';
 else if(ageMs>120000)reason='STALE_OBSERVATION';
 return {status:'ANALYZED',reason,eventType:type,
   officialVerified:false,playbackEnabled:false};
}
