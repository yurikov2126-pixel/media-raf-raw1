import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
const partNames={NIGHT:'Ночь',MORNING:'Утро',DAY:'День',EVENING:'Вечер'};
export default function RadioJingleSettings({token,assets=[]}){
 const [settings,setSettings]=useState(null),[preview,setPreview]=useState(null);
 const [error,setError]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{try{setSettings((await api('/radio/jingles',{token})).settings);}
 catch(e){setError(e.message);}},[token]);
 useEffect(()=>{load();},[load]);
 const save=async e=>{
  e.preventDefault();setSaving(true);setError('');setNote('');
  try{const response=await api('/radio/jingles',{token,method:'PUT',body:settings});
   setSettings(response.settings);setNote('Правила джинглов сохранены. Worker применяет их между треками Auto-DJ, если воспроизведение разрешено на сервере.');
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 if(!settings)return <section className="rounded-2xl border border-current/15 p-4 text-sm">{error||'Загрузка настроек джинглов…'}</section>;
 return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-4">
  <header><h2 className="font-semibold text-lg">Оформление эфира · Джинглы</h2>
   <p className="text-xs opacity-60">Настройка автоматических вставок в публичный MP3 между композициями Auto-DJ. LIVE и расписание имеют приоритет.</p></header>
  <form className="space-y-3" onSubmit={save}>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled}
    onChange={e=>setSettings(v=>({...v,enabled:e.target.checked}))}/>Включить джинглы в эфире Auto-DJ</label>
   <div className="grid sm:grid-cols-2 gap-3">
    <label className="text-sm space-y-1">После каждых N композиций
     <input className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" type="number" min="1" max="30" value={settings.everyTracks}
      onChange={e=>setSettings(v=>({...v,everyTracks:Number(e.target.value)}))}/></label>
    <label className="text-sm space-y-1">Максимальная длительность, секунд
     <input className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" type="number" min="1" max="60" value={settings.maxDurationMs/1000}
      onChange={e=>setSettings(v=>({...v,maxDurationMs:Number(e.target.value)*1000}))}/></label>
   </div>
   <fieldset className="space-y-2"><legend className="text-sm font-semibold">Периоды оформления</legend>
    <div className="flex flex-wrap gap-3">{Object.entries(partNames).map(([id,name])=>
     <label key={id} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.dayparts.includes(id)}
      onChange={e=>setSettings(v=>({...v,dayparts:e.target.checked?[...v.dayparts,id]:v.dayparts.filter(p=>p!==id)}))}/>{name}</label>)}</div>
   </fieldset>
   <details className="rounded-xl border border-current/15 p-3">
    <summary className="cursor-pointer text-sm font-semibold">Выбрать джинглы из библиотеки ({settings.assetIds.length})</summary>
    <div className="max-h-64 overflow-auto mt-3 space-y-2">{assets.filter(a=>a.durationMs>=1000&&a.durationMs<=60000).map(a=>
     <label key={a.id} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={settings.assetIds.includes(a.id)}
       onChange={e=>setSettings(v=>({...v,assetIds:e.target.checked?[...v.assetIds,a.id]:v.assetIds.filter(id=>id!==a.id)}))}/>
      <span className="truncate">{a.name}</span><span className="opacity-50 whitespace-nowrap">{Math.round(a.durationMs/1000)} с</span>
     </label>)}</div>
   </details>
   <div className="flex gap-2 flex-wrap">
    <button type="submit" disabled={saving||!settings.dayparts.length} className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm disabled:opacity-40">{saving?'Сохранение…':'Сохранить правила'}</button>
    <button type="button" className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={async()=>{
     try{setPreview((await api('/radio/jingles/preview',{token})));setError('');}catch(e){setError(e.message);}
    }}>Проверить план и эфир</button>
   </div>
  </form>
  {preview&&<div className="rounded-xl border border-current/15 p-3 space-y-2 text-sm">
   <p className="font-semibold">Джинглы · {partNames[preview.daypart]||'нет активной ротации'}</p>
   <p className="text-xs">{preview.active?'Вставки включены на Worker':preview.workerAvailable?'Вставки в Worker отключены':'Worker недоступен'}</p>
   {Number.isFinite(preview.played)&&<p className="text-xs">Воспроизведено: {preview.played} · Музыки с последнего: {preview.musicSinceJingle}</p>}
   {preview.breaks?.length?preview.breaks.map((v,i)=><p key={i} className="text-xs">Перед композицией № {v.beforeTrack+1}: {v.name} ({Math.round(v.durationMs/1000)} с)</p>)
    :<p className="text-xs opacity-60">Для текущей программы вставок нет.</p>}
   <p className="text-xs opacity-60">{preview.note}</p></div>}
  {error&&<p role="alert" className="text-red-500 text-sm">{error}</p>}
  {note&&<p role="status" className="text-sm text-emerald-500">{note}</p>}
 </section>;
}
