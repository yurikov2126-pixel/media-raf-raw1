import {prisma} from './prisma.js';

const KEY='radio_hourly_time_signal_v1';
export const DEFAULT_TIME_SIGNAL={enabled:false,mode:'BALANCED',thresholdSeconds:60,maxDelaySeconds:60,fadeMs:1500,timezone:'Europe/Moscow',preRoll:true,hourAssetIds:Array(24).fill(null)};
export function validateTimeSignal(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Неверные параметры объявления времени');
 const v={...DEFAULT_TIME_SIGNAL,...input};
 if(typeof v.enabled!=='boolean'||!['BALANCED','STRICT','SOFT'].includes(v.mode)||v.timezone!=='Europe/Moscow'||typeof v.preRoll!=='boolean')throw new TypeError('Неверный режим объявления времени');
 if(!Number.isInteger(v.thresholdSeconds)||v.thresholdSeconds<15||v.thresholdSeconds>180||
 !Number.isInteger(v.maxDelaySeconds)||v.maxDelaySeconds<0||v.maxDelaySeconds>180||
 !Number.isInteger(v.fadeMs)||v.fadeMs<0||v.fadeMs>5000)throw new TypeError('Недопустимые интервалы часового сигнала');
 if(!Array.isArray(v.hourAssetIds)||v.hourAssetIds.length!==24||v.hourAssetIds.some(x=>x!==null&&(typeof x!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(x))))throw new TypeError('Нужно указать по одной записи на каждый час');
 return {enabled:v.enabled,mode:v.mode,thresholdSeconds:v.thresholdSeconds,maxDelaySeconds:v.maxDelaySeconds,fadeMs:v.fadeMs,timezone:v.timezone,preRoll:v.preRoll,hourAssetIds:[...v.hourAssetIds]};
}
export async function readTimeSignal(db=prisma){
 const row=await db.setting.findUnique({where:{key:KEY}});
 try{return validateTimeSignal(JSON.parse(row?.value||'{}'));}
 catch{return {...DEFAULT_TIME_SIGNAL,hourAssetIds:[...DEFAULT_TIME_SIGNAL.hourAssetIds]};}
}
export async function writeTimeSignal(input,db=prisma){
 const value=validateTimeSignal(input);
 const ids=[...new Set(value.hourAssetIds.filter(Boolean))];
 if(ids.length){
  const count=await db.radioAsset.count({where:{id:{in:ids},category:'TIME_SIGNAL',durationMs:{gte:1000,lte:60000}}});
  if(count!==ids.length)throw new TypeError('Выберите записи категории «Объявления времени» длительностью 1–60 секунд');
 }
 await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(value)},update:{value:JSON.stringify(value)}});
 return value;
}
