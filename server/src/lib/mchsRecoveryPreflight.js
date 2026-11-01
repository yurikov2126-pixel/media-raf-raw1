import {normalizeExecutionJournal} from './mchsExecutionJournal.js';
/** Non-actuating preflight for an operator following successful PCM training. */
export function assessMchsRecoveryPreflight({journal,worker,android,agentVerified=false}={}){
 const current=normalizeExecutionJournal(journal);
 const holds=[];
 if(current.state==='HALTED'||current.state==='INTERRUPTED')holds.push('OPERATOR_REVIEW_REQUIRED');
 if(!worker||worker.reachable!==true)holds.push('WORKER_UNREACHABLE');
 if(worker?.trainingActive===true)holds.push('TRAINING_OVERLAY_ACTIVE');
 if(android?.connected!==true)holds.push('ANDROID_MONITOR_UNCONFIRMED');
 if(!agentVerified)holds.push('WINDOWS_AGENT_NOT_TESTED');
 return {readyForPhysicalOutput:false,readyForAutomaticExecution:false,
  operatorReviewRequired:holds.length>0,holds,checkpoint:current.state};
}
