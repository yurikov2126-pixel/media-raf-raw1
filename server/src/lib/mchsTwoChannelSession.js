import {normalizeMchsPlaybackAck} from './mchsPlaybackAckNormalizer.js';
import {assessMchsDualChannelTransition} from './mchsDualChannelTransition.js';

/** A single read-only coordinator for real event-bound evidence.
 * Never dispatches an emergency alarm to a public stream or amplifier.
 */
export function assessMchsTwoChannelSession({event,workerStart,agentStart,workerStop,agentStop,
 operatorHold=true,nowMs=Date.now()}={}){
 const eventId=event?.id;
 const eventType=event?.eventType;
 const validate=(raw,action)=>normalizeMchsPlaybackAck(raw,{eventId,eventType,action,nowMs});
 const ws=validate(workerStart,'START'),as=validate(agentStart,'START');
 const we=validate(workerStop,'STOP'),ae=validate(agentStop,'STOP');
 const started=assessMchsDualChannelTransition({eventId,eventType,action:'START',
  worker:ws.ack,agent:as.ack,nowMs});
 const stopped=assessMchsDualChannelTransition({eventId,eventType,action:'STOP',
  worker:we.ack,agent:ae.ack,nowMs});
 const reasons=[...new Set([
  ...(operatorHold?['OPERATOR_HOLD']:[]),
  ...[ws,as,we,ae].map((r,i)=>r.reason&&['WORKER_START','AGENT_START','WORKER_STOP','AGENT_STOP'][i]+'_'+r.reason).filter(Boolean),
  ...started.holds.map(x=>'START_'+x),...stopped.holds.map(x=>'STOP_'+x)
 ])];
 return {eventId:eventId||null,eventType:eventType||null,started,stopped,
  complete:started.bothConfirmed&&stopped.bothConfirmed,
  holds:reasons,output:'READ_ONLY_TWO_CHANNEL_EVIDENCE',
  automaticPlaybackEnabled:false,publicBroadcastAuthorized:false,
  amplifierActuationAuthorized:false};
}
