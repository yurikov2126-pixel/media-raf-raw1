import { prisma } from './prisma.js';

const KEY='radio_autodj_v1';
export async function readAutoDjSettings(db=prisma) {
  const row=await db.setting.findUnique({where:{key:KEY}});
  let parsed={};
  try {parsed=row?.value?JSON.parse(row.value):{};} catch {}
  return {
    enabled: parsed.enabled === true,
    playlistId: typeof parsed.playlistId==='string'?parsed.playlistId:null,
    finishTrackBeforeSchedule: parsed.finishTrackBeforeSchedule===true,
  };
}
export async function writeAutoDjSettings(settings,db=prisma) {
  const saved={enabled:settings.enabled===true,playlistId:settings.playlistId||null,
    finishTrackBeforeSchedule:settings.finishTrackBeforeSchedule===true};
  return db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(saved)},
    update:{value:JSON.stringify(saved)}});
}
export function autoDjCursor(assets, timestamp=Date.now()) {
  if (!assets.length) return null;
  const total=assets.reduce((sum,a)=>sum+a.durationMs,0);
  if(!total)return null;
  let position=((timestamp % total)+total)%total;
  for(let i=0;i<assets.length;i++){
    const a=assets[i];
    if(position<a.durationMs)return {id:a.id,name:a.name,index:i,offsetMs:position,durationMs:a.durationMs};
    position-=a.durationMs;
  }
  return null;
}
export function selectAutoDjAssets(playlist) {
  if(!playlist||playlist.status!=='APPROVED')return [];
  return playlist.items.map(i=>i.asset).filter(a=>Number.isSafeInteger(a.durationMs)&&a.durationMs>0&&a.durationMs<=12*3600000);
}
