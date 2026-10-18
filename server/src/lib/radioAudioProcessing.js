import { prisma } from './prisma.js';

const KEY='radio_audio_processing_v1';
export const DEFAULT_AUDIO_PROCESSING=Object.freeze({
  enabled:false,
  loudnessTarget:-16,
  truePeak:-2,
  fadeMs:0,
  crossfadeMs:0,
});

export function validateAudioProcessing(input) {
  if(!input || typeof input!=='object' ||
    typeof input.enabled!=='boolean' ||
    !Number.isInteger(input.loudnessTarget) || input.loudnessTarget < -24 || input.loudnessTarget > -12 ||
    !Number.isInteger(input.truePeak) || input.truePeak < -6 || input.truePeak > -1 ||
    !Number.isInteger(input.fadeMs) || input.fadeMs < 0 || input.fadeMs > 3000 ||
    !Number.isInteger(input.crossfadeMs) || input.crossfadeMs < 0 || input.crossfadeMs > 5000)
    throw new TypeError('Недопустимые настройки обработки звука');
  return {enabled:input.enabled,loudnessTarget:input.loudnessTarget,
    truePeak:input.truePeak,fadeMs:input.fadeMs,crossfadeMs:input.crossfadeMs};
}
export async function readAudioProcessing(db=prisma) {
  const row=await db.setting.findUnique({where:{key:KEY}});
  try {return validateAudioProcessing({...DEFAULT_AUDIO_PROCESSING,...JSON.parse(row?.value||'{}')});}
  catch{return {...DEFAULT_AUDIO_PROCESSING};}
}
export async function writeAudioProcessing(settings,db=prisma) {
  const config=validateAudioProcessing(settings);
  await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(config)},
    update:{value:JSON.stringify(config)}});
  return config;
}
/** FFmpeg filter args as distinct CLI tokens; all numeric inputs validated. */
export function audioProcessingFilter(config,durationSeconds=0) {
  const value=validateAudioProcessing(config);
  if(!value.enabled)return null;
  // Single-pass loudnorm works for mixed, previously unanalysed library tracks;
  // limiter constrains digital peaks. Exact integrated LUFS requires two-pass analysis.
  const filters=[`loudnorm=I=${value.loudnessTarget}:TP=${value.truePeak}:LRA=11:linear=false`];
  if(value.fadeMs>0){
    const seconds=value.fadeMs/1000;
    filters.push(`afade=t=in:st=0:d=${seconds}`);
    if(Number.isFinite(durationSeconds) && durationSeconds>seconds*2)
      filters.push(`afade=t=out:st=${Math.max(0,durationSeconds-seconds).toFixed(3)}:d=${seconds}`);
  }
  return filters.join(',');
}
