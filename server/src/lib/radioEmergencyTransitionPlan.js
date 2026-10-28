/**
 * Emergency broadcast handover PREPARATION ONLY.
 *
 * Pure state machine: no audio, network, GPIO, dispatch, or actual switching.
 * Explicitly does not trust an incoming Android/MCHS notification as an
 * instruction to start playout.
 */
export const EMERGENCY_OUTPUTS=Object.freeze(['radio','speakers']);
export const EMERGENCY_STATES=Object.freeze({
  IDLE:'IDLE',PREPARED:'PREPARED',ACTIVE:'ACTIVE',STOPPING:'STOPPING',RECOVERING:'RECOVERING'
});
const boundedText=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
const validTargets=targets=>Array.isArray(targets)&&targets.length>0&&
  targets.every(x=>EMERGENCY_OUTPUTS.includes(x))&&new Set(targets).size===targets.length;
const deny=(reason,state='IDLE')=>({accepted:false,state,reason,effects:[]});
/**
 * Transition requests are accepted only from a separately authenticated
 * emergency-control plane. The caller MUST enforce permissions externally.
 * An unverified notification never sets trustedControlPlane=true.
 */
export function planEmergencyTransition(state,request,options={}){
 const current=Object.values(EMERGENCY_STATES).includes(state?.phase)?state:{phase:'IDLE'};
 const type=request?.type;
 if(!['PREPARE','ACTIVATE','STOP','RECOVER','RESET'].includes(type))return deny('UNKNOWN_ACTION',current.phase);
 if(options.emergencyFeatureEnabled!==true)return deny('EMERGENCY_FEATURE_DISABLED',current.phase);
 if(options.trustedControlPlane!==true)return deny('UNTRUSTED_CONTROL_PLANE',current.phase);
 if(options.operatorAuthorized!==true)return deny('OPERATOR_NOT_AUTHORIZED',current.phase);
 const requestId=boundedText(request?.requestId);
 if(!requestId)return deny('REQUEST_ID_REQUIRED',current.phase);
 const expected=boundedText(state?.requestId);
 if(type!=='PREPARE'&&expected!==requestId)return deny('REQUEST_ID_MISMATCH',current.phase);
 const accepted=(phase,reason,effects=[])=>({accepted:true,state:phase,reason,requestId,effects});
 if(type==='PREPARE'){
   if(current.phase!=='IDLE')return deny('BUSY',current.phase);
   if(!validTargets(request.targets))return deny('INVALID_TARGETS',current.phase);
   if(options.audioAssetReady!==true)return deny('AUDIO_NOT_READY',current.phase);
   return accepted('PREPARED','READY',[]);
 }
 if(type==='ACTIVATE'){
   if(current.phase!=='PREPARED')return deny('NOT_PREPARED',current.phase);
   if(options.outputChainVerified!==true)return deny('OUTPUT_CHAIN_NOT_VERIFIED',current.phase);
   return accepted('ACTIVE','ACTIVATION_PLAN_ONLY',['DUCK_EXISTING_AUDIO','START_EMERGENCY_AUDIO']);
 }
 if(type==='STOP'){
   if(current.phase!=='ACTIVE'&&current.phase!=='PREPARED')return deny('NOT_ACTIVE',current.phase);
   return accepted('STOPPING','STOP_REQUESTED',['STOP_EMERGENCY_AUDIO','KEEP_OUTPUT_SAFE']);
 }
 if(type==='RECOVER'){
   if(current.phase!=='STOPPING')return deny('NOT_STOPPING',current.phase);
   if(options.emergencyAudioStopped!==true)return deny('AUDIO_STILL_RUNNING',current.phase);
   return accepted('RECOVERING','RECOVERY_REQUESTED',['RESTORE_PROGRAM_FROM_CURRENT_TIMELINE']);
 }
 if(type==='RESET'){
   if(current.phase!=='RECOVERING')return deny('NOT_RECOVERING',current.phase);
   if(options.programResumed!==true)return deny('PROGRAM_NOT_RESUMED',current.phase);
   return accepted('IDLE','RESET_COMPLETE',[]);
 }
 return deny('UNKNOWN_ACTION',current.phase);
}
/** Stale emergency state must fail closed, not automatically resume audio. */
export function emergencyWatchdog(state,nowMs,timeoutMs=15000){
 const phase=state?.phase||'IDLE';
 if(phase==='IDLE')return {action:'NONE',phase};
 const updatedAt=Number(state?.updatedAtMs);
 if(!Number.isFinite(updatedAt)||updatedAt<=0||!Number.isFinite(nowMs)||nowMs-updatedAt>timeoutMs)
   return {action:'MANUAL_INTERVENTION_REQUIRED',phase,reason:'EMERGENCY_CONTROL_STATE_STALE'};
 return {action:'NONE',phase};
}
