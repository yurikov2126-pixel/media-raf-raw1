/** Pure timing authority for an AutoDJ <-> scheduled PCM handover.
 * No schedule is shifted merely because a decoder takes time to start.
 */
export function planSourceHandover({
 fromMode,toMode,nowMs,boundaryMs,overlapMs=1500,
 finishTrackBeforeSchedule=false,sourceRemainingMs=Infinity,targetDurationMs=Infinity
}={}){
 if(!['AUTO_DJ','SCHEDULED'].includes(fromMode)||!['AUTO_DJ','SCHEDULED'].includes(toMode)||
  fromMode===toMode||!Number.isFinite(nowMs)||!Number.isFinite(boundaryMs)||
  !Number.isSafeInteger(overlapMs)||overlapMs<250||overlapMs>5000)
  return {allowed:false,reason:'INVALID_TIMELINE'};
 if(fromMode==='AUTO_DJ'&&finishTrackBeforeSchedule)
  return {allowed:false,reason:'FINISH_TRACK_POLICY'};
 if(!Number.isFinite(sourceRemainingMs)&&sourceRemainingMs!==Infinity)
  return {allowed:false,reason:'INVALID_SOURCE_REMAINING'};
 if(!Number.isFinite(targetDurationMs)&&targetDurationMs!==Infinity)
  return {allowed:false,reason:'INVALID_TARGET_DURATION'};
 const startMs=boundaryMs-overlapMs;
 if(nowMs>startMs)return {allowed:false,reason:'OVERLAP_START_MISSED'};
 if(sourceRemainingMs<Math.max(0,startMs-nowMs)+overlapMs||
   targetDurationMs<overlapMs)return {allowed:false,reason:'INSUFFICIENT_AUDIO'};
 // On schedule entry the target is advanced during the mixed interval,
 // so at the authoritative boundary it must begin at exactly overlapMs.
 const targetSeekAfterMs=overlapMs;
 return {allowed:true,startMs,endMs:boundaryMs,overlapMs,targetSeekAfterMs,
  sourceWindowMs:overlapMs};
}
export function targetSeekAfterHandover({consumedFrames,baseSeekMs=0}={}){
 if(!Number.isSafeInteger(consumedFrames)||consumedFrames<0||
  !Number.isSafeInteger(baseSeekMs)||baseSeekMs<0)
  throw new RangeError('Invalid committed target PCM offset');
 return baseSeekMs+consumedFrames/48;
}
