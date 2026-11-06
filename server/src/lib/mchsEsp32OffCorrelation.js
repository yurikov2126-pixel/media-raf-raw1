/** Correlate firmware GPIO13 OFF commands with nearby Agent evidence.
 * Firmware events carry the server's observation time, not GPIO transition time;
 * so these are diagnostic hints, NEVER proof of electrical causes.
 */
const ALLOWED_MS=15000;
const AGENT_KINDS=new Set([
 'AGENT_POWER_POWER_COMMAND','AGENT_POWER_INTENT_RESPONSE',
 'AGENT_POWER_INTENT_ERROR','AGENT_POWER_POWER_ERROR',
 'AGENT_POWER_RELAY_TRANSITION'
]);
const HINTS={
 HEARTBEAT_TIMEOUT:'ESP32_HEARTBEAT_TIMEOUT',
 POWER_LEASE_EXPIRED:'ESP32_LEASE_EXPIRED',
 WIFI_LOST:'ESP32_WIFI_LOSS',
 WIFI_RECONNECT:'ESP32_WIFI_RECONNECT',
 SIGNED_PERMIT_FALSE:'AGENT_SIGNED_OFF',
 POWER_INTERLOCK_REJECTED:'ESP32_INTERLOCK',
 SIGNED_MAINTENANCE_RESTART:'ESP32_MAINTENANCE',
 SIGNED_FIRMWARE_UPDATE:'ESP32_FIRMWARE_UPDATE',
 FIRMWARE_UPDATE_COMPLETED:'ESP32_FIRMWARE_UPDATE',
 SCHEDULED_REBOOT:'ESP32_REBOOT',
 UNSPECIFIED_OFF:'ESP32_UNSPECIFIED_OFF'
};
export function correlateEsp32OffEvents(events=[],{maxOffs=12}={}){
 const rows=Array.isArray(events)?events:[];
 const offs=rows.filter(e=>e?.kind==='FIRMWARE_GPIO_OFF'&&
  typeof e.deviceId==='string'&&Number.isFinite(Date.parse(e.at)));
 const output=[];
 for(const off of offs.slice(-maxOffs)){
  const offMs=Date.parse(off.at);
  const near=rows.filter(e=>e?.deviceId===off.deviceId&&
   e?.reporterId===off.reporterId&&AGENT_KINDS.has(e?.kind)&&
   Number.isFinite(Date.parse(e.at))&&Math.abs(Date.parse(e.at)-offMs)<=ALLOWED_MS)
   .sort((a,b)=>Math.abs(Date.parse(a.at)-offMs)-Math.abs(Date.parse(b.at)-offMs));
  // Prefer a concrete Agent OFF command acknowledgement rather than just
  // a poll response. Keep a separate nearby error count for context.
  const offAck=near.find(e=>e.kind==='AGENT_POWER_POWER_COMMAND'&&e.permit===false);
  const intentDenied=near.find(e=>e.kind==='AGENT_POWER_INTENT_RESPONSE'&&e.permit===false);
  const error=near.find(e=>e.kind==='AGENT_POWER_INTENT_ERROR'||
   e.kind==='AGENT_POWER_POWER_ERROR');
  const closest=offAck||intentDenied||error||near[0]||null;
  output.push({
   at:off.at,seq:Number.isSafeInteger(off.seq)?off.seq:null,
   reason:typeof off.detail==='string'?off.detail:'UNKNOWN',
   firmwareHint:HINTS[off.detail]||'FIRMWARE_REASON_UNCLASSIFIED',
   nearestAgentKind:closest?.kind||null,
   nearestAgentReason:typeof closest?.reason==='string'?closest.reason:null,
   nearestAgentPermit:typeof closest?.permit==='boolean'?closest.permit:null,
   approximateGapMs:closest?Math.abs(Date.parse(closest.at)-offMs):null,
   agentOffAcknowledgedNearby:!!offAck,
   agentIntentDeniedNearby:!!intentDenied,
   agentErrorNearby:!!error,
   classification:offAck?'AGENT_OFF_ACK_NEARBY':
    intentDenied?'AGENT_OFF_INTENT_NEARBY':
    error?'AGENT_ERROR_NEARBY':'NO_DECISIVE_AGENT_EVIDENCE',
   evidenceIsObservationOnly:true,
   actualMainsPowerVerified:false,
   exactTransitionTimeKnown:false
  });
 }
 return {readOnly:true,windowMs:ALLOWED_MS,items:output,
  allTimesApproximate:true,physicalOutputConfirmed:false};
}
