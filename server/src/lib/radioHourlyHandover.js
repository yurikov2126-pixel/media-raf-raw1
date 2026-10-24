// Hourly hour-boundary interruption policy, separated from the PCM writer.
// Current authority and eligible signal must be confirmed before acting.
export function planHourlyTrackHandover({enabled,source,atMs,boundaryMs,remainingMs,
 thresholdSeconds=60,maxDelaySeconds=60,mode='BALANCED',hasSignal=false,
 live=false,scheduledSlotActive=false,alreadyHandled=false}){
 const deny=reason=>({action:'NONE',reason});
 if(!enabled)return deny('DISABLED');
 if(!hasSignal)return deny('NO_READY_SIGNAL');
 if(live)return deny('LIVE_PRIORITY');
 if(alreadyHandled)return deny('ALREADY_HANDLED');
 if(!['AUTO_DJ','SCHEDULED'].includes(source))return deny('UNSUPPORTED_SOURCE');
 if(scheduledSlotActive)return deny('SCHEDULE_AUTHORITY');
 if(!Number.isFinite(atMs)||!Number.isFinite(boundaryMs)||!Number.isFinite(remainingMs))
  return deny('INVALID_CLOCK');
 const delta=atMs-boundaryMs;
 if(delta<0)return deny('BEFORE_BOUNDARY');
 if(delta>maxDelaySeconds*1000)return deny('AFTER_DEADLINE');
 if(mode==='STRICT')return {action:'FADE_AND_ADVANCE',reason:'STRICT_HOUR'};
 if(mode==='SOFT')return remainingMs<=maxDelaySeconds*1000-delta
  ?{action:'FINISH_THEN_ANNOUNCE',reason:'SOFT_FINISH'}:deny('SOFT_DEADLINE');
 if(remainingMs>thresholdSeconds*1000)return {action:'FADE_AND_ADVANCE',reason:'LONG_TRACK'};
 if(remainingMs<=maxDelaySeconds*1000-delta)return {action:'FINISH_THEN_ANNOUNCE',reason:'SHORT_TRACK'};
 return deny('DEADLINE_UNREACHABLE');
}
