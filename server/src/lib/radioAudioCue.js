import { prisma } from './prisma.js';
const KEY='radio_audio_cues_v1';
export function validateCue(cue,durationMs) {
  const inMs=cue?.inMs, outMs=cue?.outMs;
  if(!Number.isInteger(durationMs)||durationMs<=0||!Number.isInteger(inMs)||!Number.isInteger(outMs)||
    inMs<0||outMs>durationMs||outMs-inMs<1000)
    throw new TypeError('Cue In/Out должны оставлять не менее 1 секунды аудио');
  return {inMs,outMs};
}
export async function readCues(db=prisma) {
  const row=await db.setting.findUnique({where:{key:KEY}});
  try {const value=JSON.parse(row?.value||'{}');return value && typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
export async function writeCue(id,cue,db=prisma) {
  const cues=await readCues(db);
  cues[id]=cue;
  await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(cues)},
    update:{value:JSON.stringify(cues)}});
  return cue;
}
export function cueAssets(assets,cues={}) {
  return assets.map(asset=>{
    let cue={inMs:0,outMs:asset.durationMs};
    try {if(cues[asset.id])cue=validateCue(cues[asset.id],asset.durationMs);}catch{}
    return {...asset,cue,playDurationMs:cue.outMs-cue.inMs};
  }).filter(asset=>asset.playDurationMs>=1000);
}
export function cueCursor(assets,nowMs=Date.now()) {
  const total=assets.reduce((sum,a)=>sum+a.playDurationMs,0);
  if(total<=0)return null;
  let offset=((nowMs%total)+total)%total;
  for(let index=0;index<assets.length;index++){
    const asset=assets[index];
    if(offset<asset.playDurationMs)return {
      id:asset.id,name:asset.name,index,offsetMs:offset,
      seekMs:asset.cue.inMs+offset,durationMs:asset.playDurationMs,
    };
    offset-=asset.playDurationMs;
  }
  return null;
}
