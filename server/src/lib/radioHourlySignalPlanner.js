// Pure, side-effect-free planner. The PCM controller must confirm authority
// before ever committing a decision to the audible station bus.
const HOUR_MS=3600000;
export const hourBoundary=nowMs=>Math.floor(nowMs/HOUR_MS)*HOUR_MS;
export function planHourlySignal({settings,nowMs,mode,remainingMs,activeHourKeys=[]}){
 if(!settings?.enabled)return {action:'DISABLED'};
 if(!Number.isFinite(nowMs))return {action:'SKIP',reason:'CLOCK_INVALID'};
 const boundary=hourBoundary(nowMs);
 const hour=new Date(boundary).getUTCHours();
 const moscowHour=(hour+3)%24;
 const assetId=settings.hourAssetIds?.[moscowHour]||null;
 const key=new Date(boundary).toISOString();
 if(!assetId)return {action:'SKIP',key,reason:'MISSING_AUDIO'};
 if(activeHourKeys.includes(key))return {action:'SKIP',key,reason:'ALREADY_HANDLED'};
 if(mode==='LIVE')return {action:'SKIP',key,reason:'LIVE_PRIORITY'};
 const lateness=nowMs-boundary;
 const maxDelay=settings.maxDelaySeconds*1000;
 if(lateness>maxDelay)return {action:'SKIP',key,reason:'TOO_LATE'};
 const remaining=Number.isFinite(remainingMs)?Math.max(0,remainingMs):null;
 if(settings.mode==='STRICT')return {action:'ANNOUNCE',key,assetId,reason:'STRICT_BOUNDARY',fadeMs:settings.fadeMs};
 if(remaining===null)return {action:'SKIP',key,reason:'UNKNOWN_TRACK_REMAINDER'};
 if(settings.mode==='SOFT')return remaining<=maxDelay-lateness
   ?{action:'WAIT_EOF',key,assetId,reason:'FINISH_TRACK'}
   :{action:'SKIP',key,reason:'SOFT_DEADLINE'};
 if(remaining>settings.thresholdSeconds*1000)
  return {action:'ANNOUNCE',key,assetId,reason:'INTERRUPT_LONG_TRACK',fadeMs:settings.fadeMs};
 return remaining<=maxDelay-lateness
  ?{action:'WAIT_EOF',key,assetId,reason:'FINISH_SHORT_TRACK'}
  :{action:'SKIP',key,reason:'DEADLINE_BEFORE_EOF'};
}
export function nextHourlyBoundary(nowMs){return (Math.floor(nowMs/HOUR_MS)+1)*HOUR_MS;}
