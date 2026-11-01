/** Operator-owned, persisted execution policy. Real automatic actuation is hard-disabled.
 * Do not mistake Android bridge authentication for official attestation.
 */
export const MCHS_EXECUTION_POLICY_KEY='mchs_execution_control_v1';
export const defaultMchsExecutionPolicy=()=>({
 operatorHold:true,requestedMode:'DISABLED',lastChangedAt:null,lastChangedBy:null,
 reason:'AUTOMATIC_PLAYBACK_NOT_AUTHORIZED'
});
export function normalizeMchsExecutionPolicy(value){
 const defaults=defaultMchsExecutionPolicy();
 if(!value||typeof value!=='object')return defaults;
 return {...defaults,operatorHold:true,
  requestedMode:'DISABLED',
  lastChangedAt:typeof value.lastChangedAt==='string'?value.lastChangedAt:null,
  lastChangedBy:typeof value.lastChangedBy==='string'?value.lastChangedBy:null,
  reason:typeof value.reason==='string'?value.reason.slice(0,300):defaults.reason};
}
export function assessMchsExecutionReadiness({policy,checkpoint,intents=[],sourceOfficiallyVerified=false,workerAvailable=false}={}){
 const normalized=normalizeMchsExecutionPolicy(policy);
 const holds=['AUTOMATIC_EXECUTION_NOT_IMPLEMENTED'];
 if(normalized.operatorHold)holds.push('OPERATOR_HOLD');
 if(!sourceOfficiallyVerified)holds.push('OFFICIAL_SOURCE_NOT_VERIFIED');
 if(!workerAvailable)holds.push('WORKER_NOT_CONFIRMED');
 if(!checkpoint||!['CLEAR','DANGER'].includes(checkpoint.state))holds.push('STATE_UNKNOWN');
 const staged=intents.filter(item=>item.status==='STAGED').length;
 const expired=intents.filter(item=>item.status==='EXPIRED').length;
 return {policy:normalized,holds,eligibleForAutomaticPlayback:false,executionEnabled:false,
  sourceOfficiallyVerified:false,queue:{staged,expired,total:intents.length},
  checkpointState:checkpoint?.state||'UNKNOWN'};
}
