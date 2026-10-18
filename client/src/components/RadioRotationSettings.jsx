import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
const categories={ENERGY:'Энергичная',POP:'Поп-музыка',CALM:'Спокойная',INSTRUMENTAL:'Инструментальная',OTHER:'Другая'};
const partNames={NIGHT:'Ночь · 00–07',MORNING:'Утро · 07–11',DAY:'День · 11–18',EVENING:'Вечер · 18–24'};
export default function RadioRotationSettings({token,assets=[]}){
 const [preview,setPreview]=useState(null),[settings,setSettings]=useState(null),[error,setError]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{try{setSettings((await api('/radio/rotation',{token})).rotation);}catch(e){setError(e.message);}},[token]);
 useEffect(()=>{load();},[load]);
 const save=async(e)=>{e.preventDefault();setSaving(true);setError('');setNote('');
   try{const x=await api('/radio/rotation',{token,method:'PUT',body:settings});setSettings(x.rotation);setNote('Ротация сохранена. Изменения вступят в силу при выборе очередного трека.');}
   catch(e){setError(e.message);}finally{setSaving(false);}
 };
 if(!settings)return <p className="text-sm opacity-60">Загрузка музыкальной ротации… {error}</p>;
 return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-3">
  <h3 className="text-lg font-semibold">Музыкальная ротация · Авто-DJ</h3>
  <p className="text-sm opacity-70">Категории и музыкальная программа по московскому времени. Неизвестные треки считаются категорией «Другая».</p>
  <form onSubmit={save} className="space-y-4">
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))} className="h-5 w-5 accent-blue-600"/>Включить правила ротации</label>
   <div className="grid gap-3 sm:grid-cols-2">
    {Object.entries(partNames).map(([id,name])=><fieldset key={id} className="rounded-xl border border-current/15 p-3">
     <legend className="px-1 text-sm font-semibold">{name}</legend>
     <div className="grid grid-cols-2 gap-2">{Object.entries(categories).map(([key,label])=><label key={key} className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={settings.dayparts[id]?.includes(key)||false} onChange={e=>setSettings(s=>{
       const current=s.dayparts[id];const next=e.target.checked?[...current,key]:current.filter(v=>v!==key);
       return {...s,dayparts:{...s.dayparts,[id]:next}};
      })}/>{label}</label>)}</div>
    </fieldset>)}
   </div>
   <label className="block space-y-1 text-sm">Минимум других композиций между песнями одного исполнителя
    <select className="w-full max-w-xs rounded-xl border border-current/20 bg-transparent p-3" value={settings.artistGap??0}
     onChange={e=>setSettings(v=>({...v,artistGap:Number(e.target.value)}))}>
     {[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n===0?'Без ограничения':n+' комп.'}</option>)}
    </select>
   </label>
   <p className="text-xs opacity-65">Если записей недостаточно для выбранного интервала, Auto-DJ продолжит эфир с максимально возможным разделением исполнителей. Это правило действует в пределах каждой ротации, включая переход от её последней композиции к первой.</p>
   <fieldset className="rounded-xl border border-current/15 p-3 space-y-2">
    <legend className="text-sm font-semibold px-1">Приоритет категорий в музыкальной программе</legend>
    <p className="text-xs opacity-60">1 — низкий, 5 — высокий. Композиции более высокого приоритета располагаются раньше в рамках периода; это пока не весовая случайная выборка.</p>
    <div className="grid sm:grid-cols-2 gap-2">{Object.entries(categories).map(([id,label])=><label key={id} className="flex justify-between items-center gap-2 text-sm">{label}
     <select className="rounded-lg border border-current/20 bg-transparent p-2" value={settings.categoryPriority?.[id]??3}
      onChange={e=>setSettings(v=>({...v,categoryPriority:{...v.categoryPriority,[id]:Number(e.target.value)}}))}>
      {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
     </select></label>)}</div>
   </fieldset>
   <div className="rounded-xl border border-current/15 p-3 space-y-2">
    <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={async()=>{
     try{setPreview(await api('/radio/rotation/preview',{token}));setError('');}catch(e){setError(e.message);}
    }}>Предпросмотр очереди</button>
    {preview&&<div className="space-y-1 text-xs"><p className="opacity-65">Текущий период: {partNames[preview.daypart]||'без ротации'}</p>
     {preview.tracks.length?preview.tracks.map((t,i)=><p key={t.id+'-'+i}>{i+1}. {t.name} · {categories[t.category]}</p>):<p>Нет утверждённого плейлиста Авто-DJ</p>}</div>}
   </div>
   <details className="rounded-xl border border-current/15 p-3"><summary className="cursor-pointer text-sm font-semibold">Назначить категории аудиозаписям ({assets.length})</summary>
    <div className="mt-3 max-h-72 space-y-2 overflow-auto">{assets.map(a=><label key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
     <span className="min-w-0 truncate">{a.name}</span>
     <select className="max-w-40 rounded-lg border border-current/20 bg-transparent p-2" value={settings.tags[a.id]||'OTHER'} onChange={e=>setSettings(s=>({...s,tags:{...s.tags,[a.id]:e.target.value}}))}>
      {Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}
     </select>
     <input value={settings.artists?.[a.id]||''} maxLength={100} placeholder="Исполнитель" aria-label={'Исполнитель: '+a.name}
      onChange={e=>setSettings(v=>({...v,artists:{...v.artists,[a.id]:e.target.value}}))}
      className="w-32 min-w-0 rounded-lg border border-current/20 bg-transparent p-2 text-xs"/>
    </label>)}</div>
   </details>
   <p className="text-xs opacity-65">Внутри периода порядок композиций меняется по дням, без случайных перестановок после рестарта. На границе периодов музыкальная программа может переключиться на следующую категорию. Это не меняет точные старты передач.</p>
   {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
   {note&&<p role="status" className="text-sm text-emerald-500">{note}</p>}
   <button disabled={saving||Object.values(settings.dayparts).some(a=>!a.length)} type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?'Сохранение…':'Сохранить ротацию'}</button>
  </form>
 </section>;
}