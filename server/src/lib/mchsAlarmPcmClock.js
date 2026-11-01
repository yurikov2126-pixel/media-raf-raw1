/** Monotonic paced PCM frame clock, for the training ALARM path only.
 * Never skips source PCM frames to catch up: audible continuity wins over wall time.
 */
export function createAlarmPcmClock({frameMs=20,now=()=>performance.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let due=null,frames=0,gaps=0,maxDelayMs=0;
 return {
  async pace(){
   const time=now();
   if(due===null)due=time;
   const delay=time-due;
   if(delay>frameMs*2){gaps++;maxDelayMs=Math.max(maxDelayMs,Math.round(delay));}
   // After a large delay, reset the wall clock rather than trying to flood the encoder.
   if(delay>frameMs*4)due=time;
   const wait=Math.max(0,due-now());
   if(wait>0)await sleep(wait);
   frames++;due+=frameMs;
   return {frames,gaps,maxDelayMs,lateMs:Math.max(0,Math.round(delay))};
  },
  snapshot(){return {frames,gaps,maxDelayMs};},
  reset(){due=null;frames=0;gaps=0;maxDelayMs=0;}
 };
}
