/** Authoritative schedule probe; never trust the browser for broadcast priority. */
export async function readRadioScheduleAuthority(prisma,{now=new Date()}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new TypeError('Invalid clock');
  const slot=await prisma.radioScheduleSlot.findFirst({
    where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
    select:{id:true,startAt:true,endAt:true,playlistId:true},
    orderBy:{startAt:'asc'},
  });
  return {known:true,active:!!slot,slotId:slot?.id??null,
    // Asset readiness is not inferred merely from an approved playlist.
    sourceReady:false,checkedAt:now.getTime()};
}
/** Read-only projection with explicit fail-closed unknown schedule state. */
export function scheduleAwareReadiness({authority=null,readiness=null}={}){
  const known=authority?.known===true;
  return {scheduleKnown:known,scheduledActive:known?authority.active:null,
    scheduledSourceReady:known?authority.sourceReady:null,
    scheduleCheckedAt:known?authority.checkedAt:null,
    scheduledSlotId:known?authority.slotId:null,
    ...readiness,
    // This diagnostic must never grant an on-air handover.
    diagnosticReady:known?Boolean(readiness?.diagnosticReady):false,
    blockers:[...new Set([...(readiness?.blockers||[]),...(!known?['SCHEDULE_AUTHORITY_UNAVAILABLE']:[])])],
    changeApplied:false,liveOutputConnected:false};
}
