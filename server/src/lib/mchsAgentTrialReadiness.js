/** Pure diagnostic summary. It must never be used as permission to execute. */
export function summarizeMchsTrialStartReadiness({
 deviceBound=false,trialEnabled=false,dispatchHalted=true,
 deviceLedgerHalted=true,pendingAction=null,event=null,nowMs=Date.now()
}={}){
 const reasons=[];
 if(!deviceBound)reasons.push('DEVICE_NOT_BOUND');
 if(!trialEnabled)reasons.push('TRIAL_DISABLED');
 if(dispatchHalted)reasons.push('DISPATCH_HALTED');
 if(deviceLedgerHalted)reasons.push('DEVICE_LEDGER_HALTED');
 if(pendingAction)reasons.push('COMMAND_PENDING');
 reasons.push('LOCAL_OUTPUT_ISOLATION_NOT_ATTESTED','LOCAL_WAV_DIGEST_NOT_BOUND');
 if(!event)reasons.push('VERIFIED_ANDROID_EVENT_MISSING');
 else if(event.source!=='MCHS_ANDROID'||event.verified!==true)
  reasons.push('VERIFIED_ANDROID_EVENT_MISSING');
 else {
  const age=nowMs-Date.parse(event.occurredAt||'');
  if(!Number.isFinite(age)||age<0||age>120000)
   reasons.push('ANDROID_EVENT_NOT_FRESH');
 }
 return {mode:'READ_ONLY_HEADPHONES_PREFLIGHT',ready:false,startQueued:false,
  automaticPlaybackEnabled:false,publicStreamAllowed:false,amplifierAllowed:false,
  deviceBound,trialEnabled,dispatchHalted,deviceLedgerHalted,pendingAction,
  lastVerifiedEventId:event?.source==='MCHS_ANDROID'&&event?.verified===true?
   event.id:null,reasons};
}
