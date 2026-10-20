/** Read-only requirements for the last scheduled track -> AutoDJ overlap.
 * A stable prepared AutoDJ source is required to avoid a duplicate song head.
 * No mutation of the station clock, scheduled slot or playlist rotation.
 */
export function planReverseHandover({
 nowMs,slotEndMs,remainingMs,overlapMs=1500,
 lastScheduledTrack=false,autoDjEnabled=false,target=null,
 prepared=null,publicLive=false,competingSlot=false
}={}){
 if(!Number.isFinite(nowMs)||!Number.isFinite(slotEndMs)||
   !Number.isFinite(remainingMs)||remainingMs<0||
   !Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000)
  return {allowed:false,reason:'INVALID_TIMELINE'};
 if(publicLive||competingSlot)return {allowed:false,reason:'HIGHER_PRIORITY_SOURCE'};
 if(!lastScheduledTrack)return {allowed:false,reason:'NOT_FINAL_SCHEDULED_TRACK'};
 if(!autoDjEnabled)return {allowed:false,reason:'AUTO_DJ_DISABLED'};
 if(!target?.id||!Number.isFinite(target.seekMs)||target.seekMs<0)
  return {allowed:false,reason:'TARGET_UNKNOWN'};
 if(prepared?.assetId!==target.id||prepared?.seekMs!==target.seekMs||
   prepared?.failed===true)
  return {allowed:false,reason:'TARGET_NOT_PREPARED'};
 const startMs=slotEndMs-overlapMs;
 if(nowMs>startMs)return {allowed:false,reason:'START_MISSED'};
 if(remainingMs<slotEndMs-nowMs)return {allowed:false,reason:'SOURCE_TOO_SHORT'};
 return {allowed:true,startMs,endMs:slotEndMs,overlapMs,
  targetId:target.id,targetSeekAfterMs:target.seekMs+overlapMs};
}
export function verifyReverseHandoverCommit({plannedTargetId,selectedTargetId,
 consumedFrames,expectedFrames}={}){
 if(!plannedTargetId||plannedTargetId!==selectedTargetId)
  return {allowed:false,reason:'TARGET_CHANGED'};
 if(!Number.isSafeInteger(consumedFrames)||!Number.isSafeInteger(expectedFrames)||
   consumedFrames!==expectedFrames||expectedFrames<=0)
  return {allowed:false,reason:'INCOMPLETE_PCM'};
 return {allowed:true,consumedFrames,seekDeltaMs:consumedFrames/48};
}
