import {createTrainingOverlay} from './radioMchsTrainingOverlay.js';
/** Offline end-to-end PCM trial: real frame replacement, no station encoder wiring.
 * Required use of synthetic/clearly training PCM only.
 */
export function runIsolatedMissileAlarmPcmTrial({music,danger,clear,frameBytes=3840}={}){
 const valid=b=>Buffer.isBuffer(b)&&b.length>0&&b.length%4===0;
 if(![music,danger,clear].every(valid)||!Number.isInteger(frameBytes)||frameBytes<4||frameBytes%4)
  return {ok:false,reason:'INVALID_PCM',executionEnabled:false};
 const overlay=createTrainingOverlay({enabled:true});
 const stages=[];let revision=0;
 const emit=(name,audio)=>{
  const started=overlay.startWith(audio);
  if(!started.ok)return false;
  let frames=0,changed=false;
  while(overlay.snapshot().active&&frames<10000){
   const base=Buffer.alloc(frameBytes);
   for(let i=0;i<frameBytes;i++)base[i]=music[i%music.length];
   const result=overlay.replace(base);
   if(!result.equals(base))changed=true;
   frames++;
  }
  if(overlay.snapshot().active){overlay.stop();return false;}
  stages.push({name,frames,changed,stopReason:overlay.snapshot().lastStopReason});
  revision=overlay.snapshot().revision;
  return true;
 };
 if(!emit('DANGER',danger)||!emit('ALL_CLEAR',clear))
  return {ok:false,reason:'TRIAL_FAILED',stages,executionEnabled:false};
 const resumed=overlay.replace(music).equals(music);
 return {ok:resumed&&stages.every(s=>s.changed&&s.stopReason==='FILE_COMPLETED'),
  stages,resumedNormalPcm:resumed,revision,executionEnabled:false,
  output:'ISOLATED_PCM_ONLY',stationEncoderTouched:false};
}
