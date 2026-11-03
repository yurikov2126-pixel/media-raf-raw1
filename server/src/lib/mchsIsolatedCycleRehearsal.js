import {runMchsTwoChannelExecution} from './mchsTwoChannelExecutor.js';
import {assessMchsStationResume} from './mchsStationResumeEvidence.js';

/** Isolated integration rehearsal with injected channels and snapshots.
 * This function never obtains real Android events, commands production
 * devices or grants public broadcast authority. Normal completion has no STOP.
 */
export async function rehearseMchsIsolatedCycle({
 danger,allClear,authorization,worker,agent,readResumeEvidence,
 now=()=>Date.now(),signal,startTimeoutMs=10000,
 completionTimeoutMs=300000,stopTimeoutMs=5000
}={}){
 const results=[];
 const deny=(reason,details={})=>({
  ok:false,reason,results,...details,automaticBroadcastEnabled:false,
  publicPlaybackAuthorized:false,physicalAudibilityVerified:false
 });
 if(authorization?.approved!==true||authorization.mode!=='ISOLATED_TRIAL'||
    authorization.outputIsolationVerified!==true||
    authorization.publicStreamAllowed!==false||authorization.amplifierAllowed!==false)
  return deny('ISOLATED_REHEARSAL_REQUIRED');
 if(!danger||!allClear||danger.id===allClear.id||
    danger.assetId===allClear.assetId||
    danger.eventType!=='MISSILE_DANGER'||
    allClear.eventType!=='MISSILE_ALL_CLEAR'||
    allClear.repeats!==1||
    typeof readResumeEvidence!=='function')
  return deny('INVALID_REHEARSAL_SEQUENCE');
 for(const [stage,event] of [['DANGER',danger],['ALL_CLEAR',allClear]]){
  if(signal?.aborted)return deny('REHEARSAL_CANCELLED',{stage});
  const execution=await runMchsTwoChannelExecution({
   event,authorization,worker,agent,now,signal,
   startTimeoutMs,completionTimeoutMs,stopTimeoutMs
  });
  if(!execution.ok){
   results.push({stage,eventId:event.id,execution,returnedToStation:false});
   return deny('AUDIO_EXECUTION_FAILED',{stage,executionReason:execution.reason});
  }
  let evidence;
  try{evidence=await readResumeEvidence(event);}
  catch{
   results.push({stage,eventId:event.id,execution,returnedToStation:false});
   return deny('RESUME_EVIDENCE_UNAVAILABLE',{stage});
  }
  const resume=assessMchsStationResume({eventId:event.id,nowMs:now(),...evidence});
  results.push({stage,eventId:event.id,execution,returnedToStation:resume.bothSoftwareChannelsResumed,resume});
  if(!resume.bothSoftwareChannelsResumed)
   return deny('PROGRAM_RETURN_UNCONFIRMED',{stage,holds:resume.holds});
 }
 return {
  ok:true,reason:'ISOLATED_CYCLE_SOFTWARE_CONFIRMED',results,
  normalProgramSoftwareVerified:true,manualStopRequired:false,
  automaticBroadcastEnabled:false,publicPlaybackAuthorized:false,
  physicalAudibilityVerified:false
 };
}
