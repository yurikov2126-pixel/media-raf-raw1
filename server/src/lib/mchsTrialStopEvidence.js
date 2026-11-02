/** Conservative description of isolated trial-process shutdown, not acoustic silence. */
export function validateMchsTrialStopEvidence(body){
 if(!body||body.mode!=='LAB_PROCESS_ONLY'||body.kind!=='TRIAL_VLC_STOP'||
    typeof body.processExited!=='boolean'||typeof body.relayClosed!=='boolean'||
    body.paOutputVerified!==false||body.stationPlaybackStoppedVerified!==false||
    typeof body.reason!=='string'||!['OPERATOR_STOP','WATCHDOG','TRIAL_ENDED'].includes(body.reason))
  return null;
 return {mode:'LAB_PROCESS_ONLY',kind:'TRIAL_VLC_STOP',processExited:body.processExited,
  relayClosed:body.relayClosed,reason:body.reason,paOutputVerified:false,
  stationPlaybackStoppedVerified:false,confirmed:body.processExited&&body.relayClosed};
}
