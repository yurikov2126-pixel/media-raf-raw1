/** The execution guard is independent of event classification. */
export function assessAlarmExecutionGate({mode='DISABLED',operatorHold=true,sourceHealthy=false,
 workerHealthy=false,physicalOutputIsolated=false,trainingAcknowledged=false}={}){
 const holds=[];
 if(mode!=='TRAINING')holds.push('EXECUTION_DISABLED');
 if(operatorHold)holds.push('OPERATOR_HOLD');
 if(!sourceHealthy)holds.push('SOURCE_UNHEALTHY');
 if(!workerHealthy)holds.push('WORKER_UNAVAILABLE');
 if(!physicalOutputIsolated)holds.push('PHYSICAL_OUTPUT_NOT_CONFIRMED_ISOLATED');
 if(!trainingAcknowledged)holds.push('TRAINING_NOT_ACKNOWLEDGED');
 return {allowed:holds.length===0,holds,realAutomaticPlaybackEnabled:false};
}
/** In-memory state helper. All steps remain cancellable by explicit STOP. */
export function transitionAlarmExecutor(state,event){
 if(event==='STOP')return {state:'HALTED',reason:'OPERATOR_STOP'};
 if(state==='HALTED')return {state,reason:'OPERATOR_HOLD'};
 if(event==='DANGER'&&state==='IDLE')return {state:'DANGER_PENDING',reason:null};
 if(event==='CLEAR'&&state==='DANGER_ACTIVE')return {state:'CLEAR_PENDING',reason:null};
 return {state,reason:'INVALID_TRANSITION'};
}
