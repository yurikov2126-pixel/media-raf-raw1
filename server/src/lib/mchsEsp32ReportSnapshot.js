/** Read-only snapshot of one authenticated Windows Agent / ESP32 health report.
 * These facts do NOT prove physical mains power or PA audibility.
 */
export function buildEsp32ReportSnapshot(status,{observedAt,reporterId,agentPowerEvidence}={}){
 const report=status&&typeof status==='object'?status:{};
 const validU32=n=>Number.isSafeInteger(n)&&n>=0&&n<=4294967295;
 const safeText=(s,max=64)=>typeof s==='string'?s.slice(0,max):null;
 const ring=Array.isArray(report.relayTransitionHistory)?
  report.relayTransitionHistory:null;
 return {
  observedAt,reporterId,agentMode:report.agentMode,
  heartbeatFresh:report.heartbeatFresh===true,
  heartbeatCount:Number(report.heartbeatCount)||0,
  leaseValid:report.leaseValid===true,
  relayOutputEnabled:report.relayOutputEnabled===true,
  amplifierPower:report.amplifierPower||'UNKNOWN',
  bootNonce:safeText(report.bootNonce,32),
  relayOnTransitions:validU32(report.relayOnTransitions)?report.relayOnTransitions:null,
  relayOffTransitions:validU32(report.relayOffTransitions)?report.relayOffTransitions:null,
  lastRelayTransitionMs:validU32(report.lastRelayTransitionMs)?report.lastRelayTransitionMs:null,
  lastRelayOffReason:safeText(report.lastRelayOffReason),
  lastRelayOnReason:safeText(report.lastRelayOnReason),
  relayTransitionSequence:validU32(report.relayTransitionSequence)?report.relayTransitionSequence:null,
  firmwareHistoryReported:!!(ring&&ring.length<=12&&
   /^[a-f0-9]{16}$/.test(report.bootNonce||'')&&
   validU32(report.relayTransitionSequence)),
  agentPowerEvidenceReported:Array.isArray(agentPowerEvidence)
 };
}
