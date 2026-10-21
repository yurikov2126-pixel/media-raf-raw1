// Heartbeat freshness for registered Windows radio agents.
// Agent polls /agent/status; this represents last authenticated contact,
// NOT confirmed audio output, network RTT or acoustic continuity.
export const AGENT_HEARTBEAT_TTL_MS=45000;
export function agentHeartbeatState(device,nowMs=Date.now()){
 const timestamp=device.lastSeenAt?Date.parse(device.lastSeenAt):NaN;
 const ageMs=Number.isFinite(timestamp)?Math.max(0,nowMs-timestamp):null;
 const revoked=Boolean(device.revokedAt);
 const status=revoked?'REVOKED':ageMs===null?'NEVER_SEEN':ageMs<=AGENT_HEARTBEAT_TTL_MS?'ONLINE':'OFFLINE';
 return {id:device.id,name:device.name,status,lastSeenAt:device.lastSeenAt||null,
  ageMs,playbackAllowed:!!device.playbackAllowed};
}
export function summarizeRadioAgents(devices,nowMs=Date.now()){
 const agents=devices.map(device=>agentHeartbeatState(device,nowMs));
 const enabled=agents.filter(a=>a.status!=='REVOKED');
 return {ttlMs:AGENT_HEARTBEAT_TTL_MS,generatedAt:new Date(nowMs).toISOString(),
  registered:enabled.length,online:enabled.filter(a=>a.status==='ONLINE').length,
  offline:enabled.filter(a=>a.status==='OFFLINE').length,
  neverSeen:enabled.filter(a=>a.status==='NEVER_SEEN').length,agents};
}
