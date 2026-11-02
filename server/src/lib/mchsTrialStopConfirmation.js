/** Read-only, fail-closed assessment of the last *isolated* VLC stop report.
 * No report here proves that the live station or PA amplifier is silent.
 */
export const MCHS_TRIAL_STOP_TTL_MS=30000;
export function assessMchsTrialStopConfirmation(evidence,{nowMs=Date.now(),deviceBound=false}={}){
 const holds=[];
 if(!deviceBound)holds.push('AGENT_DEVICE_NOT_BOUND');
 const received=Date.parse(evidence?.receivedAt||'');
 const ageMs=Number.isFinite(received)?nowMs-received:null;
 const fresh=ageMs!==null&&ageMs>=0&&ageMs<=MCHS_TRIAL_STOP_TTL_MS;
 if(!fresh)holds.push('TRIAL_STOP_REPORT_MISSING_OR_STALE');
 const reportValid=evidence?.mode==='LAB_PROCESS_ONLY'&&evidence?.kind==='TRIAL_VLC_STOP'&&
  typeof evidence.processExited==='boolean'&&typeof evidence.relayClosed==='boolean'&&
  evidence.paOutputVerified===false&&evidence.stationPlaybackStoppedVerified===false;
 if(fresh&&!reportValid)holds.push('TRIAL_STOP_REPORT_INVALID');
 if(fresh&&reportValid&&!evidence.processExited)holds.push('TRIAL_VLC_STILL_RUNNING');
 if(fresh&&reportValid&&!evidence.relayClosed)holds.push('TRIAL_RELAY_NOT_CLOSED');
 const labProcessStopConfirmed=deviceBound&&fresh&&reportValid&&
  evidence.processExited===true&&evidence.relayClosed===true;
 return {status:labProcessStopConfirmed?'LAB_PROCESS_STOP_CONFIRMED':'STOP_NOT_CONFIRMED',
  labProcessStopConfirmed,reportFresh:fresh,reportAgeMs:ageMs,
  holds,stationPlaybackStoppedVerified:false,paOutputVerified:false,
  dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
