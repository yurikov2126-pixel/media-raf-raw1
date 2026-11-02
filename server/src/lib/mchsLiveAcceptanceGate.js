/** MCHS activation assurance gate.
 * No software telemetry substitutes for an independently verified PA test.
 * This evaluator never authorizes real output.
 */
export const MCHS_LIVE_ACCEPTANCE_REQUIREMENTS=Object.freeze([
 'AUTHENTIC_SOURCE_VALIDATED',
 'REGION_AND_EVENT_VERIFIED',
 'DANGER_AND_ALL_CLEAR_CYCLE_TESTED',
 'WINDOWS_AGENT_STOP_VERIFIED',
 'WORKER_STOP_VERIFIED',
 'NO_REPLAY_AFTER_RECONNECT',
 'HARDWARE_ISOLATION_AND_EMERGENCY_OFF_TESTED',
 'AUTHORIZED_SAFETY_OFFICER_SIGNOFF'
]);
export function assessMchsLiveAcceptance(evidence={},nowMs=Date.now()){
 const missing=[];
 for(const key of MCHS_LIVE_ACCEPTANCE_REQUIREMENTS){
  const report=evidence&&typeof evidence==='object'?evidence[key]:null;
  const testedAt=Date.parse(report?.testedAt||'');
  // Diagnostic self-reports are intentionally not proof of physical safety.
  if(report?.verified!==true||report?.independent!==true||
     !Number.isFinite(testedAt)||testedAt>nowMs||nowMs-testedAt>86400000)missing.push(key);
 }
 return {phase:missing.length?'ACCEPTANCE_INCOMPLETE':'REQUIRES_SEPARATE_PHYSICAL_AUTHORIZATION',
  requirements:MCHS_LIVE_ACCEPTANCE_REQUIREMENTS,missing,
  canRunIsolatedTests:true,realAutomaticBroadcastEnabled:false,
  paOutputAuthorized:false,automaticPlaybackEnabled:false,
  operatorHold:true,physicalOutputVerifiedBySoftware:false};
}
