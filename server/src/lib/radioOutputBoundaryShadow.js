/**
 * Output-boundary admission policy for an ISOLATED harness only.
 * No audio, processes, sockets, hardware or encoder are modified.
 * A failed predicate always refuses presenter admission.
 */
export function inspectRadioOutputBoundary({
  scheduleKnown=false,scheduledActive=null,scheduleRevision=null,
  preparedRevision=null,sessionValid=false,presenterLease=null,preparedLease=null,
  pcmState=null,nowMs=Date.now(),minimumBufferedMs=100,maxPcmAgeMs=1500,
}={}){
  const blockers=[];
  if(scheduleKnown!==true||!Number.isSafeInteger(scheduleRevision)||scheduleRevision<0)
    blockers.push('SCHEDULE_UNVERIFIED');
  else if(scheduledActive!==false)blockers.push('SCHEDULE_RESERVED');
  if(!Number.isSafeInteger(preparedRevision)||preparedRevision!==scheduleRevision)
    blockers.push('REVISION_CHANGED');
  if(sessionValid!==true||typeof presenterLease!=='string'||!presenterLease||
    presenterLease!==preparedLease)blockers.push('LEASE_REVOKED');
  if(pcmState?.state!=='READY'||pcmState?.connectedToEncoder!==false)
    blockers.push('PCM_NOT_READY');
  if(!Number.isFinite(pcmState?.bufferedMs)||pcmState.bufferedMs<minimumBufferedMs)
    blockers.push('INSUFFICIENT_BUFFER');
  if(!Number.isFinite(pcmState?.pcmLastAt)||!Number.isFinite(nowMs)||
    pcmState.pcmLastAt>nowMs||nowMs-pcmState.pcmLastAt>maxPcmAgeMs)
    blockers.push('PCM_STALE');
  return {canSimulatePresenter:!blockers.length,blockers,
    fallback:blockers.length?'AUTO_DJ':null,changeApplied:false,
    connectedToEncoder:false};
}
