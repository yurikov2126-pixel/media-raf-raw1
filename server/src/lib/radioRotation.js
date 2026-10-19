import { prisma } from './prisma.js';

const KEY='radio_rotation_v1';
export const id3Artist = asset => typeof asset?.tags?.artist==='string' ? asset.tags.artist.trim() : '';
export const normalizeArtist = name => String(name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
export const CATEGORIES=['ENERGY','POP','CALM','INSTRUMENTAL','OTHER'];
export const DAYPARTS=[
  {id:'NIGHT',start:0,end:7},
  {id:'MORNING',start:7,end:11},
  {id:'DAY',start:11,end:18},
  {id:'EVENING',start:18,end:24},
];
export const DEFAULT_ROTATION={enabled:false,tags:{},artists:{},artistGap:0,categoryPriority:{},cooldownMinutes:0,strictCooldown:false,allowCooldownFallback:false,dayparts:{
  NIGHT:['CALM','INSTRUMENTAL','OTHER'],
  MORNING:['ENERGY','POP','OTHER'],
  DAY:['POP','ENERGY','INSTRUMENTAL','OTHER'],
  EVENING:['CALM','POP','OTHER'],
}};
export function validateRotation(input) {
  if(!input || typeof input.enabled!=='boolean')throw new TypeError('Некорректные параметры ротации');
  if(typeof input.allowCooldownFallback!=='boolean')throw new TypeError('Некорректная настройка резервного воспроизведения');
  if(typeof input.strictCooldown!=='boolean')throw new TypeError('Некорректный режим строгого интервала');
  if(!Number.isInteger(input.cooldownMinutes)||input.cooldownMinutes<0||input.cooldownMinutes>240)throw new TypeError('Пауза повторов: от 0 до 240 минут');
  if(!Number.isInteger(input.artistGap)||input.artistGap<0||input.artistGap>5)throw new TypeError('Интервал исполнителей: от 0 до 5 композиций');
  return {enabled:input.enabled,artistGap:input.artistGap,
    cooldownMinutes:input.cooldownMinutes,strictCooldown:input.strictCooldown,
    allowCooldownFallback:input.allowCooldownFallback};

}
export async function readRotation(db=prisma){
  const row=await db.setting.findUnique({where:{key:KEY}});
  try {return validateRotation({...DEFAULT_ROTATION,...JSON.parse(row?.value||'{}')});}
  catch {return {enabled:false,artistGap:0,cooldownMinutes:0,strictCooldown:false,allowCooldownFallback:false};}
}
export async function writeRotation(data,db=prisma){
  const rotation=validateRotation(data);
  await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(rotation)},
    update:{value:JSON.stringify(rotation)}});
  return rotation;
}
function hash(s){
  let h=2166136261;
  for(const char of s){h=Math.imul(h^char.charCodeAt(0),16777619);}
  return h>>>0;
}
/** Select a stable cyclic ordering that separates known artists whenever feasible.
 * Unknown artist metadata is not assumed to identify the same artist.
 * Every track is emitted exactly once per rotation cycle.
 */
export function separateArtists(items,artists={},gap=0){
  if(gap===0||items.length<2)return {items:[...items],violations:0};
  // Decode and normalize every ID3 Artist once per rotation, not in each
  // pairwise comparison of every trial arrangement.
  const names=items.map(item=>normalizeArtist(id3Artist(item)));
  const penalty=order=>{
    let score=0;
    for(let i=0;i<order.length;i++){
      const name=names[order[i]];
      if(!name)continue;
      for(let d=1;d<=Math.min(gap,order.length-1);d++)
        if(name===names[order[(i+d)%order.length]])score++;
    }
    return score;
  };
  const arrange=first=>{
    const remaining=items.map((_,i)=>i),result=[remaining.splice(first,1)[0]];
    while(remaining.length){
      let best=0,bestCost=Infinity;
      const recent=result.slice(-gap);
      for(let i=0;i<remaining.length;i++){
        const name=names[remaining[i]];
        let cost=0;
        if(name)for(const past of recent)if(names[past]===name)cost++;
        if(cost<bestCost){bestCost=cost;best=i;if(cost===0)break;}
      }
      result.push(remaining.splice(best,1)[0]);
    }
    return result;
  };
  let best=items.map((_,i)=>i),score=penalty(best);
  for(let i=0;i<Math.min(items.length,64)&&score>0;i++){
    const candidate=arrange(i),value=penalty(candidate);
    if(value<score){best=candidate;score=value;}
  }
  return {items:best.map(i=>items[i]),violations:score};
}
/** Only the selected approved Auto-DJ playlist may contribute rotation tracks. */
export function rotationPlaylistAssets(playlist){
  if(playlist?.status!=='APPROVED')return [];
  return (playlist.items||[]).map(item=>item.asset)
    .filter(asset=>asset&&Number.isInteger(asset.durationMs)&&asset.durationMs>0)
    .map(asset=>({...asset,playDurationMs:asset.durationMs}));
}
export function rotationPlan(assets,config,nowMs=Date.now()){
  if(!config.enabled||!assets.length)return null;
  // One day-wide rotation, unaffected by time-of-day or mood categories.
  const dayKey=new Date(nowMs).toISOString().slice(0,10);
  const start=Date.parse(dayKey+'T00:00:00Z');
  const end=start+86400000;
  const shuffled=[...assets].sort((a,b)=>hash(dayKey+a.id)-hash(dayKey+b.id)||a.id.localeCompare(b.id));
  const arranged=separateArtists(shuffled,{},config.artistGap);
  const ordered=arranged.items;
  return {items:ordered,anchorMs:start,endMs:end,daypart:null,
    activeCategories:[],cycleMs:ordered.reduce((n,a)=>n+(a.playDurationMs||a.durationMs),0),
    artistViolations:arranged.violations};
}

// Move recently generated tracks toward the end of a newly opened daypart.
// This is a best-effort cooldown, not a hard ban: no track is dropped.
// Freeze this order for the daypart to avoid changing the time-based cursor mid-track.
export function prioritizeUnplayed(items,history,minutes,nowMs){
  if(!minutes||items.length<2)return [...items];
  const cutoff=nowMs-minutes*60000;
  const latest=new Map();
  for(const row of history){
    const at=Date.parse(row.startedAt);
    if(Number.isFinite(at)&&at>cutoff&&at<=nowMs)
      latest.set(row.id,Math.max(latest.get(row.id)||0,at));
  }
  return [...items].sort((a,b)=>{
    const aAt=latest.get(a.id)||0,bAt=latest.get(b.id)||0;
    return Number(aAt>0)-Number(bAt>0)||aAt-bAt;
  });
}
