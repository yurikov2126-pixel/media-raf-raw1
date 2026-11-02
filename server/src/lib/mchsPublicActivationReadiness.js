/** Public MCHS activation gate. This is evidence evaluation, NOT a remote
 * activation endpoint. Independent evidence must be supplied by a supervised
 * end-to-end physical trial before an operator can authorize production.
 */
export function assessMchsPublicActivation({source,worker,agent,stop,trial,operator}={}){
 const missing=[];
 const requireEvidence=(condition,reason)=>{if(!condition)missing.push(reason);};
 requireEvidence(source?.officiallyAttested===true,'OFFICIAL_SOURCE_ATTESTATION_MISSING');
 requireEvidence(source?.freshEventVerified===true,'REAL_EVENT_NOT_VERIFIED');
 requireEvidence(source?.region==='Тульская область','REGION_NOT_VERIFIED');
 requireEvidence(worker?.eventBoundStart===true&&worker?.eventBoundStop===true,
  'WORKER_EVENT_BOUND_TRANSPORT_UNVERIFIED');
 requireEvidence(worker?.completedPlaybackVerified===true,'WORKER_PLAYBACK_UNVERIFIED');
 requireEvidence(agent?.eventBoundStart===true&&agent?.eventBoundStop===true,
  'AGENT_EVENT_BOUND_TRANSPORT_UNVERIFIED');
 requireEvidence(agent?.completedPlaybackVerified===true,'AGENT_PLAYBACK_UNVERIFIED');
 requireEvidence(stop?.independentChannelsVerified===true,'INDEPENDENT_STOP_UNVERIFIED');
 requireEvidence(stop?.lateStartRejected===true,'LATE_START_PROTECTION_UNVERIFIED');
 requireEvidence(stop?.linkLossFailsSafe===true,'LINK_LOSS_FAILSAFE_UNVERIFIED');
 requireEvidence(trial?.isolatedPublicOutput===true,'PUBLIC_OUTPUT_NOT_ISOLATED_DURING_TRIAL');
 requireEvidence(trial?.speakersPhysicallyDisconnected===true,'SPEAKERS_NOT_DISCONNECTED_DURING_TRIAL');
 requireEvidence(trial?.dangerAndClearCompleted===true,'END_TO_END_TRIAL_INCOMPLETE');
 requireEvidence(operator?.authorizedAfterTrial===true,'POST_TRIAL_AUTHORIZATION_MISSING');
 return {ready:missing.length===0,missing,
  automaticBroadcastEnabled:false,publicActivationPerformed:false};
}
