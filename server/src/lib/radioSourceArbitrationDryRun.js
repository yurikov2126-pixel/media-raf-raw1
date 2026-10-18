/**
 * Radio source arbitration dry run.
 * Computes *recommendations only*: never sends PCM to station output, starts audio,
 * or changes the live playout worker source.
 */
export const RADIO_SOURCE = Object.freeze({
  SCHEDULE: 'SCHEDULE',
  PRESENTER: 'PRESENTER',
  AUTO_DJ: 'AUTO_DJ',
});
export const RADIO_DECISION = Object.freeze({
  SCHEDULE_PRIORITY: 'SCHEDULE_PRIORITY',
  PRESENTER_READY: 'PRESENTER_READY',
  PRESENTER_NOT_READY: 'PRESENTER_NOT_READY',
  PRESENTER_STALE: 'PRESENTER_STALE',
  PRESENTER_BUFFERING: 'PRESENTER_BUFFERING',
  AUTO_DJ_FALLBACK: 'AUTO_DJ_FALLBACK',
});

/**
 * Pure policy: the scheduled slot always wins; live presenter is eligible only
 * with an explicitly authorized lease, a healthy decoder, recent PCM, and
 * sufficient buffered audio. Fallback is advisory and never activates output.
 */
export function planRadioSource({
  scheduledActive=false,
  scheduledSourceReady=false,
  presenterAuthorized=false,
  presenterConnected=false,
  gatewayRunning=false,
  pcmLastAt=null,
  pcmBufferedMs=0,
  nowMs=Date.now(),
  pcmStaleAfterMs=1500,
  minBufferMs=100,
}={}){
  if(!Number.isFinite(nowMs) || !Number.isFinite(pcmStaleAfterMs) ||
     pcmStaleAfterMs<=0 || !Number.isFinite(minBufferMs)||minBufferMs<0)
    throw new TypeError('Invalid radio source policy clock or thresholds');
  const fresh=Number.isFinite(pcmLastAt)&&pcmLastAt<=nowMs&&nowMs-pcmLastAt<=pcmStaleAfterMs;
  const bufferReady=Number.isFinite(pcmBufferedMs)&&pcmBufferedMs>=minBufferMs;
  if(scheduledActive){
    return {recommendedSource:scheduledSourceReady?RADIO_SOURCE.SCHEDULE:RADIO_SOURCE.AUTO_DJ,
      reason:scheduledSourceReady?RADIO_DECISION.SCHEDULE_PRIORITY:RADIO_DECISION.AUTO_DJ_FALLBACK,
      presenterEligible:false,changeApplied:false};
  }
  if(presenterAuthorized&&presenterConnected&&gatewayRunning&&fresh&&bufferReady){
    return {recommendedSource:RADIO_SOURCE.PRESENTER,reason:RADIO_DECISION.PRESENTER_READY,
      presenterEligible:true,changeApplied:false};
  }
  let reason=RADIO_DECISION.PRESENTER_NOT_READY;
  if(presenterAuthorized&&presenterConnected&&gatewayRunning){
    reason=fresh?RADIO_DECISION.PRESENTER_BUFFERING:RADIO_DECISION.PRESENTER_STALE;
  }
  return {recommendedSource:RADIO_SOURCE.AUTO_DJ,reason,
    presenterEligible:false,changeApplied:false};
}
