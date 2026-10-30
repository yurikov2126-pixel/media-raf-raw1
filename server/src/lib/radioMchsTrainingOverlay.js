/** Server-side training PCM overlay for the shared station MP3 encoder.
 * Explicit, opt-in, operator-controlled. Not a real emergency trigger.
 * Source PCM is prevalidated 48kHz stereo 16-bit signed LE, max 10 seconds.
 */
export const PCM_BYTES_PER_SECOND=48000*2*2;
export const MAX_TRAINING_SECONDS=10;
export function createTrainingOverlay({pcm,enabled=false,now=()=>Date.now()}={}){
 if(enabled && (!Buffer.isBuffer(pcm)||pcm.length===0||pcm.length%4!==0||
     pcm.length>PCM_BYTES_PER_SECOND*MAX_TRAINING_SECONDS))
  throw new TypeError('INVALID_TRAINING_PCM');
 let active=false,at=0,position=0,revision=0;
 const stop=()=>{if(active){active=false;revision++;}return snapshot();};
 function snapshot(){
  if(active && now()-at>=MAX_TRAINING_SECONDS*1000)stop();
  return {enabled,active,revision,maxSeconds:MAX_TRAINING_SECONDS,remainingBytes:active?Math.max(0,pcm.length-position):0,
   output:active?'SHARED_STATION_ENCODER_TRAINING':'NORMAL_PROGRAM',realEmergencyReady:false};
 }
 return {
  snapshot,
  start(){
   if(!enabled)return {ok:false,reason:'DISABLED',...snapshot()};
   if(active)return {ok:false,reason:'ALREADY_ACTIVE',...snapshot()};
   active=true;at=now();position=0;revision++;
   return {ok:true,...snapshot()};
  },
  stop:()=>({ok:true,...stop()}),
  replace(frame){
   if(!Buffer.isBuffer(frame)||frame.length%4!==0)throw new TypeError('INVALID_PCM_FRAME');
   if(!snapshot().active)return frame;
   const result=Buffer.alloc(frame.length);
   const n=Math.min(frame.length,pcm.length-position);
   pcm.copy(result,0,position,position+n);
   position+=n;
   if(position===pcm.length)stop();
   return result;
  }
 };
}
