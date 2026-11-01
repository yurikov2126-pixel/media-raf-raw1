import {classifyAutomaticAlarmCandidate} from './mchsAutomaticAlarmCandidate.js';
import {missileNextState} from './mchsMissileAutoGate.js';

/** Single-source Android MCHS observation workflow.
 * No social-network corroboration; no automatic loudspeaker authority.
 */
export function evaluateAndroidMissileSequence(events=[],{nowMs=Date.now(),initialState='UNKNOWN'}={}){
 let state=['UNKNOWN','CLEAR','DANGER'].includes(initialState)?initialState:'UNKNOWN';
 const seen=new Set();
 const results=[];
 for(const event of [...events].sort((a,b)=>Date.parse(a.occurredAt||0)-Date.parse(b.occurredAt||0))){
  const verdict=classifyAutomaticAlarmCandidate(event,{nowMs});
  const eventId=event?.sourceEventId;
  if(!verdict.accepted){results.push({...verdict,transition:'BLOCKED',automaticPlaybackEnabled:false});continue;}
  if(seen.has(eventId)){results.push({...verdict,transition:'BLOCKED',reason:'DUPLICATE',automaticPlaybackEnabled:false});continue;}
  seen.add(eventId);
  const next=missileNextState(state,verdict.eventType);
  if(!next.accepted){results.push({...verdict,transition:'BLOCKED',reason:next.reason,automaticPlaybackEnabled:false});continue;}
  state=next.state;
  results.push({...verdict,transition:'OBSERVED',state,reason:'SOURCE_PROVENANCE_NOT_ATTESTED',
   automaticPlaybackEnabled:false});
 }
 return {state,results,source:'MCHS_ANDROID',corroborationRequired:false,
  dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
