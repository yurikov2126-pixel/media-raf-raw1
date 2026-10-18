import {readRadioScheduleAuthority} from './radioScheduleAuthority.js';
import {evaluateRadioPresenterReadiness} from './radioPresenterReadiness.js';

/** Advisory snapshot with a true transactional revision. Never an on-air commit. */
export async function collectRadioHandoverObservation({
  prisma,workerStatus,connected=false,gatewayRunning=false,presenterId=null,
  leaseId=null,now=new Date(),
}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new TypeError('INVALID_CLOCK');
  // Repeatable read guarantees the approved slot and revision are from one
  // database snapshot. Writer triggers increment revision in their own transaction.
  const {authority,revision}=await prisma.$transaction(async tx=>{
    const row=await tx.radioScheduleRevision.findUnique({where:{id:1},select:{revision:true}});
    if(row?.revision===undefined||row?.revision===null)throw new Error('SCHEDULE_REVISION_MISSING');
    const authority=await readRadioScheduleAuthority(tx,{now});
    return {authority,revision:row.revision};
  },{isolationLevel:'RepeatableRead'});
  const scheduleRevision=Number(revision);
  if(!Number.isSafeInteger(scheduleRevision)||scheduleRevision<0)
    throw new Error('SCHEDULE_REVISION_UNSAFE');
  const readiness=evaluateRadioPresenterReadiness({
    workerStatus,presenterAuthorized:connected,presenterConnected:connected,
    gatewayRunning,scheduledActive:authority.active,scheduledSourceReady:false,
    nowMs:now.getTime(),
  });
  return {scheduleKnown:true,scheduledActive:authority.active,scheduleRevision,
    presenterAuthorized:connected,presenterConnected:connected,gatewayRunning,
    pcmReady:readiness.diagnosticReady,presenterId,leaseId,
    reason:readiness.reason,blockers:readiness.blockers,
    bufferedMs:readiness.bufferedMs,pcmAgeMs:readiness.pcmAgeMs,
    changeApplied:false,connectedToEncoder:false};
}
