/** Passive software-chain preflight for an operator-supervised headphones trial.
 * Read-only observations NEVER prove output isolation or authorize ALARM START.
 */
export function assessMchsLiveAudioPreflight({
 workerHealth, workerOverlay, agentAudio, deviceBound=false,
 nowMs=Date.now(), maxAudioAgeMs=20000
}={}){
 const holds=[];
 const hold=code=>{if(!holds.includes(code))holds.push(code);};
 const modes=new Set(['AUTO_DJ','SCHEDULED','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST']);
 if(!workerHealth||!modes.has(workerHealth.mode))hold('WORKER_PROGRAM_NOT_CONFIRMED');
 if(workerHealth?.lastError)hold('WORKER_ERROR_REPORTED');
 if(workerOverlay?.active!==false||workerOverlay?.output!=='NORMAL_PROGRAM')
  hold('TRAINING_OVERLAY_NOT_IDLE');
 if(!deviceBound)hold('AGENT_DEVICE_NOT_BOUND');
 const observedAt=Date.parse(agentAudio?.receivedAt||'');
 if(!Number.isFinite(observedAt)||observedAt>nowMs||
    nowMs-observedAt>maxAudioAgeMs)hold('AGENT_TELEMETRY_STALE');
 if(agentAudio?.source!=='CENTRAL'||agentAudio?.playback!=='PLAYING'||
    !Number.isInteger(agentAudio?.lastPacketAgeMs)||
    agentAudio.lastPacketAgeMs<0||agentAudio.lastPacketAgeMs>5000)
  hold('AGENT_CENTRAL_AUDIO_UNCONFIRMED');
 return {
  softwareChainObserved:holds.length===0,
  workerMode:modes.has(workerHealth?.mode)?workerHealth.mode:null,
  agentSource:agentAudio?.source||null,
  agentPlayback:agentAudio?.playback||null,
  holds,
  // These flags are unconditional. Telemetry cannot establish physical wiring.
  physicalOutputIsolationVerified:false,
  publicPlaybackAuthorized:false,
  automaticDispatchEnabled:false,
  mayStartAlarm:false,
  mode:'READ_ONLY_HEADPHONES_PREFLIGHT'
 };
}
