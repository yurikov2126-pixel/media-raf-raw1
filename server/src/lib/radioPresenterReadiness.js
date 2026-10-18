import {planRadioSource} from './radioSourceArbitrationDryRun.js';

/** Read-only diagnostic projection from authoritative server and Worker inputs.
 * Missing data always means NOT READY. It is never permission to route audio.
 */
export function evaluateRadioPresenterReadiness({
  workerStatus=null, presenterAuthorized=false, presenterConnected=false,
  gatewayRunning=false, scheduledActive=false, scheduledSourceReady=false,
  nowMs=Date.now(),
}={}){
  const shadow=workerStatus?.timedShadow;
  const session=workerStatus?.session;
  const pcmLastAt=shadow?.pcmLastAt;
  const bufferedMs=shadow?.bufferedMs;
  const validShadow=workerStatus?.enabled===true&&shadow?.enabled===true&&
    shadow?.connectedToEncoder===false&&shadow?.state==='READY'&&
    shadow?.fresh===true&&session?.active===true&&
    Number.isFinite(pcmLastAt)&&Number.isFinite(bufferedMs)&&bufferedMs>=0;
  const decision=planRadioSource({
    scheduledActive,scheduledSourceReady,presenterAuthorized,
    presenterConnected,gatewayRunning:gatewayRunning&&validShadow,
    pcmLastAt:validShadow?pcmLastAt:null,
    pcmBufferedMs:validShadow?bufferedMs:0,nowMs,
  });
  const blockers=[];
  if(scheduledActive)blockers.push('SCHEDULE_ACTIVE');
  if(!presenterAuthorized)blockers.push('PRESENTER_UNAUTHORIZED');
  if(!presenterConnected)blockers.push('PRESENTER_DISCONNECTED');
  if(!gatewayRunning)blockers.push('GATEWAY_STOPPED');
  if(workerStatus?.enabled!==true||session?.active!==true)blockers.push('PCM_SESSION_INACTIVE');
  if(!shadow?.enabled)blockers.push('SHADOW_DISABLED');
  if(shadow?.state!=='READY')blockers.push('SHADOW_NOT_READY');
  if(shadow?.fresh!==true||!Number.isFinite(pcmLastAt)||pcmLastAt>nowMs||nowMs-pcmLastAt>1500)
    blockers.push('PCM_STALE');
  if(!Number.isFinite(bufferedMs)||bufferedMs<100)blockers.push('PCM_BUFFER_LOW');
  return {mode:'READ_ONLY_SHADOW',liveOutputConnected:false,
    recommendedSource:decision.recommendedSource,reason:decision.reason,
    diagnosticReady:validShadow&&blockers.length===0&&decision.presenterEligible,
    blockers,bufferedMs:Number.isFinite(bufferedMs)?bufferedMs:null,
    pcmAgeMs:Number.isFinite(pcmLastAt)&&pcmLastAt<=nowMs?nowMs-pcmLastAt:null,
    changeApplied:false};
}
