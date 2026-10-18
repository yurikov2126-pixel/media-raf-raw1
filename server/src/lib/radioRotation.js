import { prisma } from './prisma.js';

const KEY='radio_rotation_v1';
export const CATEGORIES=['ENERGY','POP','CALM','INSTRUMENTAL','OTHER'];
export const DAYPARTS=[
  {id:'NIGHT',start:0,end:7},
  {id:'MORNING',start:7,end:11},
  {id:'DAY',start:11,end:18},
  {id:'EVENING',start:18,end:24},
];
export const DEFAULT_ROTATION={enabled:false,tags:{},artists:{},artistGap:0,dayparts:{
  NIGHT:['CALM','INSTRUMENTAL','OTHER'],
  MORNING:['ENERGY','POP','OTHER'],
  DAY:['POP','ENERGY','INSTRUMENTAL','OTHER'],
  EVENING:['CALM','POP','OTHER'],
}};
export function validateRotation(input) {
  if(!input || typeof input.enabled!=='boolean' || !input.tags ||
     typeof input.tags!=='object' || Array.isArray(input.tags) ||
     !input.dayparts || typeof input.dayparts!=='object')throw new TypeError('Некорректные параметры ротации');
  const tags=Object.fromEntries(Object.entries(input.tags).map(([id,tag])=>{
    if(!/^[a-z0-9_-]{1,120}$/i.test(id)||!CATEGORIES.includes(tag))throw new TypeError('Недопустимая категория');
    return [id,tag];
  }));
  if(!Number.isInteger(input.artistGap)||input.artistGap<0||input.artistGap>5)throw new TypeError('Интервал исполнителей: от 0 до 5 композиций');
  if(!input.artists||typeof input.artists!=='object'||Array.isArray(input.artists))throw new TypeError('Некорректные исполнители');
  const artists={};
  for(const [id,name] of Object.entries(input.artists)){
    if(!/^[a-z0-9_-]{1,120}$/i.test(id)||typeof name!=='string'||name.length>100)throw new TypeError('Некорректный исполнитель');
    if(name.trim())artists[id]=name.trim();
  }
  const dayparts={};
  for(const {id} of DAYPARTS){
    const choices=input.dayparts[id];
    if(!Array.isArray(choices)||choices.length<1||choices.length>CATEGORIES.length||
      choices.some(c=>!CATEGORIES.includes(c))||new Set(choices).size!==choices.length)
      throw new TypeError('Недопустимые категории периода '+id);
    dayparts[id]=choices;
  }
  return {enabled:input.enabled,tags,artists,artistGap:input.artistGap,dayparts};
}
export async function readRotation(db=prisma){
  const row=await db.setting.findUnique({where:{key:KEY}});
  try {return validateRotation({...DEFAULT_ROTATION,...JSON.parse(row?.value||'{}')});}
  catch {return {enabled:false,tags:{},artists:{},artistGap:0,dayparts:Object.fromEntries(Object.entries(DEFAULT_ROTATION.dayparts).map(([key,categories])=>[key,[...categories]]))};}
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
  const artist=item=>(artists[item.id]||'').trim().toLocaleLowerCase('ru-RU');
  const penalty=(order)=>{
    let score=0;
    for(let i=0;i<order.length;i++){
      const current=artist(order[i]);
      if(!current)continue;
      for(let distance=1;distance<=Math.min(gap,order.length-1);distance++){
        if(current===artist(order[(i+distance)%order.length]))score++;
      }
    }
    return score;
  };
  const arrange=(first)=>{
    const remaining=[...items],result=[remaining.splice(first,1)[0]];
    while(remaining.length){
      let best=0,bestCost=Infinity;
      for(let i=0;i<remaining.length;i++){
        const name=artist(remaining[i]);
        const cost=name?result.slice(-gap).filter(other=>artist(other)===name).length:0;
        if(cost<bestCost){bestCost=cost;best=i;}
      }
      result.push(remaining.splice(best,1)[0]);
    }
    return result;
  };
  let best=[...items],score=penalty(best);
  for(let i=0;i<Math.min(items.length,64)&&score>0;i++){
    const candidate=arrange(i),value=penalty(candidate);
    if(value<score){best=candidate;score=value;}
  }
  return {items:best,violations:score};
}
export function rotationPlan(assets,config,nowMs=Date.now()){
  if(!config.enabled || !assets.length)return null;
  const local=new Date(nowMs+3*3600000);
  const hour=local.getUTCHours();
  const part=DAYPARTS.find(p=>p.start<=hour&&hour<p.end);
  const dayKey=local.toISOString().slice(0,10);
  const start=Date.parse(dayKey+'T00:00:00+03:00')+part.start*3600000;
  const end=Date.parse(dayKey+'T00:00:00+03:00')+part.end*3600000;
  const allowed=new Set(config.dayparts[part.id]);
  const picked=assets.filter(a=>allowed.has(config.tags[a.id]||'OTHER'));
  // An empty category filter should not cause unexpected dead air.
  const pool=picked.length?picked:assets;
  const seed=dayKey+':'+part.id;
  // Stable pseudo-random order, independent of process restart and asset position.
  const shuffled=[...pool].sort((a,b)=>hash(seed+a.id)-hash(seed+b.id)||a.id.localeCompare(b.id));
  const arranged=separateArtists(shuffled,config.artists,config.artistGap);
  const ordered=arranged.items;
  const duration=ordered.reduce((n,a)=>n+a.playDurationMs,0);
  return {items:ordered,anchorMs:start,endMs:end,daypart:part.id,
    activeCategories:[...allowed],cycleMs:duration,artistViolations:arranged.violations};
}
