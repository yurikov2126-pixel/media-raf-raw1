/** Bounded browser headphone playout clock; isolated from public radio clock.
 * Network jitter can briefly starve the browser. Rebuffer instead of failing forever.
 */
export function planPrivatePcmSchedule({nextTime,currentTime,initialDelay=0.45,maxAhead=1.2}={}){
 if(!Number.isFinite(currentTime)||currentTime<0||!Number.isFinite(nextTime))throw new TypeError('INVALID_AUDIO_CLOCK');
 if(nextTime<currentTime+0.045)
   return {time:currentTime+initialDelay,rebuffered:true};
 if(nextTime-currentTime>maxAhead)
   return {time:currentTime+initialDelay,rebuffered:true};
 return {time:nextTime,rebuffered:false};
}
