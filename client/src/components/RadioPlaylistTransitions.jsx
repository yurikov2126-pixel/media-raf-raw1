import {useState} from 'react';
const DEFAULT={mode:'cut',overlapMs:0,curve:'equalPower'};
const pair=(a,b)=>a+'|'+b;
export function pairTransitions(ids,settings){
 return ids.slice(0,-1).map((id,i)=>settings[pair(id,ids[i+1])]||DEFAULT);
}
export function transitionSettingsFromItems(items){
 const result={};
 for(let i=0;i<items.length-1;i++){
  const a=items[i],b=items[i+1];
  if(a.transition)result[pair(a.assetId,b.assetId)]=a.transition;
 }
 return result;
}
export default function RadioPlaylistTransitions({ids,assets,settings,onChange}){
 const [expanded,setExpanded]=useState(null);
 const update=(key,patch)=>onChange(old=>({...old,[key]:{...DEFAULT,...old[key],...patch}}));
 const asset=id=>assets.find(a=>a.id===id);
 const total=ids.reduce((sum,id)=>sum+(asset(id)?.durationMs||0),0)-
  pairTransitions(ids,settings).reduce((sum,item)=>sum+item.overlapMs,0);
 return <section className="space-y-3 rounded-xl border border-current/15 p-3">
  <div><h3 className="font-semibold">Переходы между композициями</h3>
   <p className="mt-1 text-xs opacity-70">Настройка привязана к паре соседних записей. Перестановка удаляет связь с прежним соседним треком, но сохраняет настройку пары для повторного использования.</p>
   <p className="mt-1 text-xs font-medium">Расчётная длительность с наложением: {Math.ceil(total/1000)} с</p>
  </div>
  {ids.slice(0,-1).map((id,i)=>{
   const next=ids[i+1],key=pair(id,next),config=settings[key]||DEFAULT;
   const maximum=Math.min(15000,Math.floor(Math.min(asset(id)?.durationMs||0,asset(next)?.durationMs||0)/2));
   return <div key={key} className="rounded-xl border border-current/15 p-3">
    <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-sm" onClick={()=>setExpanded(expanded===key?null:key)}>
     <span className="min-w-0 truncate">{i+1} → {i+2}: {asset(id)?.name||id} / {asset(next)?.name||next}</span>
     <span className="shrink-0 font-medium">{config.mode==='crossfade'?config.overlapMs/1000+' с':'Без наложения'} {expanded===key?'▲':'▼'}</span>
    </button>
    {expanded===key&&<div className="mt-3 space-y-3">
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.mode==='crossfade'} onChange={e=>update(key,{mode:e.target.checked?'crossfade':'cut',overlapMs:e.target.checked?Math.min(5000,maximum):0})}/>Наложение треков</label>
     {config.mode==='crossfade'&&<>
      <label className="block space-y-1 text-sm">Длительность наложения: {(config.overlapMs/1000).toFixed(2)} сек.
       <input type="range" min="250" max={Math.max(250,maximum)} step="250" value={config.overlapMs} onChange={e=>update(key,{overlapMs:Number(e.target.value)})} className="w-full accent-indigo-600"/>
      </label>
      <label className="block text-sm">Кривая сведения
       <select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" value={config.curve} onChange={e=>update(key,{curve:e.target.value})}>
        <option value="equalPower">Equal Power</option><option value="linear">Линейная</option><option value="sCurve">S-Curve</option>
       </select>
      </label>
      <p className="text-xs opacity-60">Пока это сохранение перехода. Применение в эфире будет включено только после отдельной проверки PCM-микширования.</p>
     </>}
    </div>}
   </div>;
  })}
 </section>;
}
