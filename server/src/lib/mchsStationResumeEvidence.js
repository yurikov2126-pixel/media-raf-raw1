/** Read-only post-ALARM station-return assessment.
 * This never authorizes playout. Existing transport telemetry proves process
 * observations, not actual sound pressure from physical PA speakers.
 */
export function assessMchsStationResume({
 eventId,workerReceipt,workerOverlay,workerHealth,
 agentReport,agentAudio,nowMs=Date.now(),maxAgeMs=30000
}={}){
 const holds=[];
 const add=reason=>{if(!holds.includes(reason))holds.push(reason);};
 if(typeof eventId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(eventId))
  add('EVENT_ID_REQUIRED');
 const finishMs=Date.parse(workerReceipt?.completedAt||'');
 if(workerReceipt?.eventId!==eventId||workerReceipt?.trialOnly!==true||
    workerReceipt?.naturalCompletion!==true||
    workerReceipt?.lastStopReason!=='FILE_COMPLETED'||
    workerReceipt?.active!==false||
    workerReceipt?.completedRepeats!==workerReceipt?.repeats||
    !Number.isInteger(workerReceipt?.repeats)||workerReceipt.repeats<1||
    workerReceipt.repeats>5)
  add('WORKER_COMPLETION_UNCONFIRMED');
 if(!Number.isFinite(finishMs)||finishMs>nowMs||nowMs-finishMs>maxAgeMs)
  add('WORKER_COMPLETION_STALE');
 if(!workerOverlay||workerOverlay.active!==false||
    workerOverlay.output!=='NORMAL_PROGRAM')
  add('OVERLAY_NOT_RELEASED');
 const stationModes=new Set(['AUTO_DJ','SCHEDULED','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST']);
 if(!workerHealth||!stationModes.has(workerHealth.mode))
  add('STATION_SOURCE_NOT_CONFIRMED');
 if(workerHealth?.lastError)
  add('STATION_ERROR_REPORTED');
 const agentTime=Date.parse(agentReport?.reportedAt||'');
 if(agentReport?.version!==2||agentReport?.eventId!==eventId||
    agentReport?.state!=='COMPLETED'||
    agentReport?.localNaturalCompletionObserved!==true||
    agentReport?.processRunning!==false||
    agentReport?.failureReason!==null||
    agentReport?.completedRepeats!==workerReceipt?.repeats||
    agentReport?.expectedRepeats!==workerReceipt?.repeats)
  add('AGENT_ALARM_COMPLETION_UNCONFIRMED');
 if(!Number.isFinite(agentTime)||agentTime>nowMs||
    agentTime<finishMs-maxAgeMs||nowMs-agentTime>maxAgeMs)
  add('AGENT_COMPLETION_STALE');
 const audioAt=Date.parse(agentAudio?.receivedAt||'');
 if(agentAudio?.playback!=='PLAYING'||
    agentAudio?.source!=='CENTRAL'||
    !Number.isInteger(agentAudio?.lastPacketAgeMs)||
    agentAudio.lastPacketAgeMs>5000||
    agentAudio.lastPacketAgeMs<0)
  add('AGENT_CENTRAL_AUDIO_NOT_CONFIRMED');
 if(!Number.isFinite(audioAt)||audioAt>nowMs||audioAt<finishMs||
    nowMs-audioAt>20000)
  add('AGENT_AUDIO_NOT_FRESH_AFTER_ALARM');
 return {eventId:eventId||null,
  workerReturnedToProgram:!holds.some(x=>[
   'WORKER_COMPLETION_UNCONFIRMED','WORKER_COMPLETION_STALE',
   'OVERLAY_NOT_RELEASED','STATION_SOURCE_NOT_CONFIRMED',
   'STATION_ERROR_REPORTED'].includes(x)),
  agentReturnedToCentral:!holds.some(x=>[
   'AGENT_ALARM_COMPLETION_UNCONFIRMED','AGENT_COMPLETION_STALE',
   'AGENT_CENTRAL_AUDIO_NOT_CONFIRMED','AGENT_AUDIO_NOT_FRESH_AFTER_ALARM'].includes(x)),
  bothSoftwareChannelsResumed:holds.length===0,
  holds,workerCurrentMode:workerHealth?.mode||null,
  agentCurrentSource:agentAudio?.source||null,
  physicalAudibilityVerified:false,publicPlaybackAuthorized:false,
  automaticDispatchEnabled:false,output:'READ_ONLY_POST_ALARM_OBSERVATION'};
}
