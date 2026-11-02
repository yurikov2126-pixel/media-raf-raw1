import {assessMchsTwoChannelSession} from './mchsTwoChannelSession.js';
/** Deterministic event lifecycle for safety review. No external audio side effects. */
export function advanceMchsSessionLifecycle(previous,{event,workerStart,agentStart,workerStop,agentStop,halted=false,nowMs=Date.now()}={}){
 const acceptedTypes=['MISSILE_DANGER','MISSILE_ALL_CLEAR'];
 const reject=(reason)=>({state:'BLOCKED',reason,eventId:event?.id||null,automaticPlaybackEnabled:false});
 if(!event?.id||!acceptedTypes.includes(event.eventType))return reject('INVALID_EVENT');
 if(halted)return {state:'HALTED',reason:'HALT',eventId:event.id,automaticPlaybackEnabled:false};
 const prior=previous&&typeof previous==='object'?previous:{};
 if(prior.eventId===event.id&&['STOP_CONFIRMED','HALTED','BLOCKED'].includes(prior.state))
  return reject('TERMINAL_EVENT_REPLAY');
 if(prior.eventId&&prior.eventId!==event.id&&prior.state==='START_CONFIRMED')
  return reject('PREVIOUS_SESSION_NOT_STOPPED');
 const evidence=assessMchsTwoChannelSession({event,workerStart,agentStart,workerStop,agentStop,nowMs});
 const state=evidence.stopped.bothConfirmed?'STOP_CONFIRMED':
  evidence.started.bothConfirmed?'START_CONFIRMED':'PENDING_CONFIRMATIONS';
 return {eventId:event.id,eventType:event.eventType,state,
  startConfirmed:evidence.started.bothConfirmed,stopConfirmed:evidence.stopped.bothConfirmed,
  holds:evidence.holds,automaticPlaybackEnabled:false,output:'OBSERVATION_ONLY'};
}
