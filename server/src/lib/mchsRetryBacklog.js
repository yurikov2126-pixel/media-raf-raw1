/** Read-only diagnostics. A retry backlog is not evidence of an official warning. */
export function assessMchsRetryBacklog(telemetry,{nowMs=Date.now()}={}) {
 const age = telemetry?.telemetryAt ? nowMs-new Date(telemetry.telemetryAt).getTime() : NaN;
 if (!Number.isFinite(age) || age>180000 || age< -120000)
   return {state:'UNKNOWN',reason:'TELEMETRY_MISSING_OR_STALE',playbackEnabled:false};
 const queued=telemetry.queuedLocal, retried=telemetry.retryPending;
 if (!Number.isSafeInteger(queued)||!Number.isSafeInteger(retried)||queued<0||retried<0||retried>queued)
   return {state:'UNKNOWN',reason:'COUNTERS_MISSING_OR_INCONSISTENT',playbackEnabled:false};
 if (queued===0) return {state:'CLEAR',reason:'NO_PENDING_EVENTS',playbackEnabled:false};
 const next=telemetry.nextRetryAt?new Date(telemetry.nextRetryAt).getTime():NaN;
 if(retried>0 && Number.isFinite(next) && nowMs-next>300000)
   return {state:'WARNING',reason:'RETRY_OVERDUE',playbackEnabled:false};
 return {state:'PENDING',reason:retried>0?'RETRIES_SCHEDULED':'AWAITING_FIRST_ACK',playbackEnabled:false};
}
