/** Validate event-scoped *local* Agent audio evidence. Never PA delivery. */
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const reasons=new Set([
 'VLC_START_REJECTED','LOCAL_AUDIO_STOP_UNCONFIRMED',
 'CENTRAL_RETURN_UNCONFIRMED','AUDIO_INTERRUPTED_OR_TIMEOUT',
 'SERVER_STOP','SERVER_HALT'
]);
export function normalizeMchsEventExecutionObservation(value){
 const bad=reason=>({accepted:false,reason});
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)
  return bad('INVALID_VERSION');
 const {eventId,eventType,phase,expectedRepeats,completedRepeats,
   naturalCompletion,centralReturnConfirmed,processRunning,
   failureReason}=value;
 if(typeof eventId!=='string'||!idPattern.test(eventId))return bad('INVALID_EVENT');
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))
  return bad('INVALID_EVENT_TYPE');
 if(!['STARTED','PLAYING','RESTORING','COMPLETE','FAILED'].includes(phase))
  return bad('INVALID_PHASE');
 if(!Number.isSafeInteger(expectedRepeats)||expectedRepeats<1||expectedRepeats>5||
    eventType==='MISSILE_ALL_CLEAR'&&expectedRepeats!==1)
  return bad('INVALID_REPEATS');
 if(!Number.isSafeInteger(completedRepeats)||completedRepeats<0||
    completedRepeats>expectedRepeats)return bad('INVALID_COMPLETED');
 if(typeof naturalCompletion!=='boolean'||typeof centralReturnConfirmed!=='boolean'||
    typeof processRunning!=='boolean')return bad('INVALID_EVIDENCE');
 if(failureReason!==null&&
    (typeof failureReason!=='string'||!reasons.has(failureReason)))
  return bad('INVALID_FAILURE');
 if(phase==='COMPLETE'&&
   (!naturalCompletion||!centralReturnConfirmed||processRunning||
    failureReason!==null||completedRepeats!==expectedRepeats))
  return bad('CONTRADICTORY_COMPLETION');
 if(naturalCompletion&&(completedRepeats!==expectedRepeats||processRunning))
  return bad('CONTRADICTORY_NATURAL_END');
 if(phase==='FAILED'&&!failureReason)return bad('MISSING_FAILURE');
 if(phase!=='FAILED'&&failureReason!==null)return bad('FAILURE_PHASE_MISMATCH');
 if(phase==='PLAYING'&&!processRunning)return bad('PLAYING_WITHOUT_PROCESS');
 if(phase==='STARTED'&&completedRepeats!==0)return bad('INVALID_STARTED');
 if(phase==='RESTORING'&&centralReturnConfirmed)
  return bad('RETURN_ALREADY_CONFIRMED');
 return {accepted:true,value:{version:1,eventId,eventType,phase,
   expectedRepeats,completedRepeats,naturalCompletion,
   centralReturnConfirmed,processRunning,failureReason,
   localProcessObservationOnly:true,physicalPaOutputVerified:false,
   publicPlaybackAuthorized:false}};
}
