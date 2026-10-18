import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const format = ms => (ms/1000).toFixed(1);
export default function RadioCueEditor({token,assets=[]}) {
  const [cues,setCues]=useState({});
  const [selected,setSelected]=useState('');
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{
    try {const response=await api('/radio/audio-cues',{token});setCues(response.cues||{});}
    catch(e){setError(e.message);}
  },[token]);
  useEffect(()=>{reload();},[reload]);
  const asset=assets.find(a=>a.id===selected);
  const cue=asset?(cues[asset.id]||{inMs:0,outMs:asset.durationMs}):null;
  const update=(key,value)=>setCues(prev=>({...prev,[selected]:{...cue,[key]:Math.round(Number(value)*1000)}}));
  const save=async()=>{
    if(!asset)return;
    setSaving(true);setError('');setStatus('');
    try {
      const response=await api('/radio/audio-cues/'+encodeURIComponent(asset.id),{
        token,method:'PUT',body:cue
      });
      setCues(prev=>({...prev,[asset.id]:response.cue}));
      setStatus('Cue сохранены. Для Авто-DJ вступят в силу на следующем треке.');
    }catch(e){setError(e.message);}finally{setSaving(false);}
  };
  return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-3">
    <h3 className="font-semibold text-lg">Cue In / Cue Out · Авто-DJ</h3>
    <p className="text-sm opacity-70">Укажите границы воспроизводимого фрагмента. Исходный файл не меняется. Пока Cue учитываются только в Авто-DJ, чтобы не сдвигать точные старты передач.</p>
    <select value={selected} onChange={e=>{setSelected(e.target.value);setStatus('');}} className="w-full rounded-xl border border-current/20 bg-transparent p-3 text-sm" aria-label="Выбрать запись для настройки Cue">
      <option value="">Выберите аудиофайл</option>
      {assets.map(a=><option key={a.id} value={a.id}>{a.name} · {format(a.durationMs)} с</option>)}
    </select>
    {asset&&cue&&<div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm space-y-1 block">Cue In (сек)
          <input className="w-full rounded-xl border border-current/20 bg-transparent p-3" type="number" step="0.1" min="0" max={format(asset.durationMs)} value={cue.inMs/1000} onChange={e=>update('inMs',e.target.value)}/>
        </label>
        <label className="text-sm space-y-1 block">Cue Out (сек)
          <input className="w-full rounded-xl border border-current/20 bg-transparent p-3" type="number" step="0.1" min="0" max={format(asset.durationMs)} value={cue.outMs/1000} onChange={e=>update('outMs',e.target.value)}/>
        </label>
      </div>
      <p className="text-xs opacity-65">Исходная длительность: {format(asset.durationMs)} с · Фрагмент: {format(cue.outMs-cue.inMs)} с</p>
      <button type="button" onClick={save} disabled={saving||cue.outMs-cue.inMs<1000||cue.outMs>asset.durationMs||cue.inMs<0}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-white text-sm font-semibold disabled:opacity-40">{saving?'Сохранение…':'Сохранить точки Cue'}</button>
    </div>}
    {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
    {status&&<p role="status" className="text-sm text-emerald-500">{status}</p>}
  </section>;
}
