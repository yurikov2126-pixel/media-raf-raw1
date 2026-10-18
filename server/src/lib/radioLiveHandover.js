/** Read-only live handover simulation; never opens a microphone or switches PCM.
 * A transport connection or fresh browser heartbeat is NOT proof of audio samples.
 */
export function planSourceHandover({settings,scheduled=false,scheduledAt=null,
 autoDjEnabled=false,liveConnected=false,heartbeatAt=null,pcmSamplesReceived=false,
 nowMs=Date.now(),currentSource='AUTO_DJ'}){
 const timeout=Number(settings?.heartbeatTimeoutSec)||15;
 const last=heartbeatAt?Date.parse(heartbeatAt):NaN;
 const connected=!!liveConnected && Number.isFinite(last) && last<=nowMs
  && nowMs-last<=timeout*1000;
 const liveRequested=settings?.requestedSource==='LIVE'&&settings?.liveEnabled===true;
 const scheduleMs=scheduledAt?Date.parse(scheduledAt):NaN;
 const beforeSchedule=Number.isFinite(scheduleMs)&&scheduleMs>nowMs;
 let target,reason;
 if(scheduled){target='SCHEDULED';reason='ACTIVE_SCHEDULE';}
 else if(liveRequested && connected && pcmSamplesReceived){target='LIVE_CANDIDATE';reason='LIVE_PCM_READY';}
 else if(liveRequested && !settings.autoReturn){target='SILENCE';reason=connected?'PCM_NOT_READY':'LIVE_TIMEOUT';}
 else {target=autoDjEnabled?'AUTO_DJ':'SILENCE';reason=liveRequested?(connected?'PCM_NOT_READY':'LIVE_TIMEOUT'):'DEFAULT';}
 const transition=currentSource===target?'HOLD':'PENDING';
 return {target,reason,transition,currentSource,
  connectionFresh:connected,pcmSamplesReceived:!!pcmSamplesReceived,
  timeToScheduleMs:beforeSchedule?scheduleMs-nowMs:null,
  scheduledPriority:!!scheduled,activeSwitching:false,
  advisory:'Simulation only: no live PCM input or switching is connected'};
}
