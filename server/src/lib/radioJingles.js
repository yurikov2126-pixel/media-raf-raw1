import {prisma} from './prisma.js';
const KEY='radio_jingles_v1';
export const DEFAULT_JINGLES={enabled:false,assetIds:[],everyTracks:5,dayparts:['MORNING','DAY','EVENING'],maxDurationMs:30000};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(id);
export function validateJingles(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Неверные настройки джинглов');
 if(typeof input.enabled!=='boolean')throw new TypeError('Укажите состояние включения');
 if(!Array.isArray(input.assetIds)||input.assetIds.length>40||input.assetIds.some(id=>!validId(id))||new Set(input.assetIds).size!==input.assetIds.length)
  throw new TypeError('Неверный список аудиозаписей');
 if(!Number.isInteger(input.everyTracks)||input.everyTracks<1||input.everyTracks>30)throw new TypeError('Интервал: 1–30 композиций');
 if(!Number.isInteger(input.maxDurationMs)||input.maxDurationMs<1000||input.maxDurationMs>60000)throw new TypeError('Длительность джингла: 1–60 секунд');
 const allowed=['NIGHT','MORNING','DAY','EVENING'];
 if(!Array.isArray(input.dayparts)||!input.dayparts.length||input.dayparts.some(p=>!allowed.includes(p))||new Set(input.dayparts).size!==input.dayparts.length)
  throw new TypeError('Неверные периоды воспроизведения');
 return {enabled:input.enabled,assetIds:[...input.assetIds],everyTracks:input.everyTracks,
  dayparts:[...input.dayparts],maxDurationMs:input.maxDurationMs};
}
export async function readJingles(db=prisma){
 const row=await db.setting.findUnique({where:{key:KEY}});
 try{return validateJingles({...DEFAULT_JINGLES,...JSON.parse(row?.value||'{}')});}
 catch{return {...DEFAULT_JINGLES,assetIds:[],dayparts:[...DEFAULT_JINGLES.dayparts]};}
}
export async function writeJingles(input,db=prisma){
 const settings=validateJingles(input);
 await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(settings)},update:{value:JSON.stringify(settings)}});
 return settings;
}
/** Preview insertion points only; scheduled broadcasts and live feeds always have priority. */
export function planJingleBreaks({tracks,settings,daypart,assets=[]}){
 if(!settings.enabled||!settings.dayparts.includes(daypart)||!settings.assetIds.length)return [];
 const valid=new Map(assets.filter(a=>a&&a.durationMs>=1000&&a.durationMs<=settings.maxDurationMs).map(a=>[a.id,a]));
 const eligible=settings.assetIds.map(id=>valid.get(id)).filter(Boolean);
 if(!eligible.length)return [];
 const out=[];
 for(let i=settings.everyTracks;i<tracks.length;i+=settings.everyTracks){
  const a=eligible[(out.length)%eligible.length];
  out.push({beforeTrack:i,assetId:a.id,name:a.name,durationMs:a.durationMs});
 }
 return out;
}
