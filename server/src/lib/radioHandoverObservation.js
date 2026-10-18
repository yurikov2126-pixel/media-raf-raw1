import {createHash} from 'node:crypto';
import {readRadioScheduleAuthority} from './radioScheduleAuthority.js';
import {evaluateRadioPresenterReadiness} from './radioPresenterReadiness.js';

// Diagnostic-only fingerprint: NOT a durable transactionally increasing DB revision.
// A change-then-revert (ABA) can produce the same fingerprint. Never use as real commit fence.
export async function collectRadioHandoverObservation({
  prisma,workerStatus,connected=false,gatewayRunning=false,presenterId=null,
  leaseId=null,now=new Date(),
}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new TypeError('INVALID_CLOCK');
  const [authority,slots]=await Promise.all([
    readRadioScheduleAuthority(prisma,{now}),
    prisma.radioScheduleSlot.findMany({
      where:{endAt:{gt:now},playlist:{status:'APPROVED'}},
      orderBy:[{startAt:'asc'},{id:'asc'}],
      select:{id:true,playlistId:true,startAt:true,endAt:true},
    }),
  ]);
  const digest=createHash('sha256').update(JSON.stringify(slots.map(s=>[
    s.id,s.playlistId,s.startAt.toISOString(),s.endAt.toISOString(),
  ]))).digest('hex');
  const scheduleRevision=parseInt(digest.slice(0,12),16);
  const readiness=evaluateRadioPresenterReadiness({
    workerStatus,presenterAuthorized:connected,presenterConnected:connected,
    gatewayRunning,scheduledActive:authority.active,scheduledSourceReady:false,
    nowMs:now.getTime(),
  });
  return {scheduleKnown:true,scheduledActive:authority.active,scheduleRevision,
    scheduleFingerprint:digest,presenterAuthorized:connected,presenterConnected:connected,
    gatewayRunning,pcmReady:readiness.diagnosticReady,presenterId,leaseId,
    reason:readiness.reason,blockers:readiness.blockers,
    bufferedMs:readiness.bufferedMs,pcmAgeMs:readiness.pcmAgeMs,
    changeApplied:false,connectedToEncoder:false};
}
