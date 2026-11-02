import {agentHeartbeatState} from './radioAgentHeartbeat.js';

// Read-only diagnostic. A heartbeat or observer report is NOT proof of PA audio.
export const MCHS_OBSERVER_TTL_MS=15000;
export function assessMchsAgentDispatchTelemetry(device, observer, nowMs=Date.now()){
 const holds=[];
 if(!device){holds.push('AGENT_DEVICE_NOT_BOUND');return {confirmed:false,connected:false,observerFresh:false,audioOutputVerified:false,holds};}
 const heartbeat=agentHeartbeatState(device,nowMs);
 const connected=heartbeat.status==='ONLINE' && heartbeat.ageMs!==null && device.playbackAllowed===true;
 if(heartbeat.status==='REVOKED')holds.push('AGENT_REVOKED');
 else if(heartbeat.status!=='ONLINE')holds.push('AGENT_HEARTBEAT_STALE');
 if(!device.playbackAllowed)holds.push('AGENT_PLAYBACK_NOT_ALLOWED');
 const received=Date.parse(observer?.receivedAt||'');
 const observerAgeMs=Number.isFinite(received)?nowMs-received:null;
 const observerFresh=observer?.mode==='OBSERVE_ONLY' && observerAgeMs!==null &&
   observerAgeMs>=0 && observerAgeMs<=MCHS_OBSERVER_TTL_MS;
 if(!observerFresh)holds.push('AGENT_OBSERVER_STALE');
 if(observerFresh && observer.code!=='OBSERVABLE_ONLY')holds.push('AGENT_OBSERVER_NOT_HEALTHY');
 if(observerFresh && !observer.primaryAlive && !observer.reserveAlive)holds.push('AGENT_NO_PLAYBACK_PROCESS');
 // Existing observer never verifies actual interruption or physical PA path.
 holds.push('AGENT_AUDIO_OUTPUT_UNVERIFIED');
 return {deviceId:device.id,confirmed:false,connected,observerFresh,
  heartbeatStatus:heartbeat.status,heartbeatAgeMs:heartbeat.ageMs,
  observerAgeMs,audioOutputVerified:false,holds};
}
