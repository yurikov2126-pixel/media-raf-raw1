import { prisma } from './prisma.js';

const KEY='radio_audio_processing_v1';
export const audioDefaults=Object.freeze({enabled:false,normalization:true,limiter:true,fadeMs:0});
export function sanitizeAudioSettings(raw={}) {
  return {
    enabled:raw?.enabled===true,
    normalization:raw?.normalization!==false,
    limiter:raw?.limiter!==false,
    fadeMs:[0,100,250,500].includes(raw?.fadeMs)?raw.fadeMs:0,
  };
}
export async function readAudioSettings(db=prisma) {
  const row=await db.setting.findUnique({where:{key:KEY}});
  let raw={};
  try{raw=JSON.parse(row?.value||'{}');}catch{}
  return sanitizeAudioSettings(raw);
}
export async function saveAudioSettings(raw,db=prisma) {
  const settings=sanitizeAudioSettings(raw);
  await db.setting.upsert({where:{key:KEY},
    create:{key:KEY,value:JSON.stringify(settings)},
    update:{value:JSON.stringify(settings)}});
  return settings;
}
/** Filters run on decoded audio, never modifying source assets.
 * Fade is only a short edge fade, NOT crossfade or timeline overlap.
 */
export function decoderAudioFilters(settings,remainingSeconds) {
  if(!settings.enabled)return [];
  const filters=[];
  if(settings.normalization)filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  if(settings.limiter)filters.push('alimiter=limit=0.90:attack=5:release=50');
  const fade=settings.fadeMs/1000;
  if(fade>0 && remainingSeconds>fade*2) {
    filters.push('afade=t=in:st=0:d='+fade);
    filters.push('afade=t=out:st='+Math.max(0,remainingSeconds-fade).toFixed(3)+':d='+fade);
  }
  return filters.length?['-af',filters.join(',')]:[];
}
