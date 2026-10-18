import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function RadioAudioProcessing({token}) {
  const [settings,setSettings]=useState({enabled:false,normalization:true,limiter:true,fadeMs:0});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const load=useCallback(()=>api('/radio/audio-processing',{token}).then(result=>setSettings(result.settings)).catch(e=>setError(e.message)),[token]);
  useEffect(()=>{load();},[load]);
  const save=async e=>{
    e.preventDefault();setBusy(true);setSaved(false);setError('');
    try{const result=await api('/radio/audio-processing',{token,method:'PUT',body:settings});setSettings(result.settings);setSaved(true);}
    catch(err){setError(err.message);}
    finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-3">
    <div><h3 className="text-lg font-semibold">Обработка звука · тестовый режим</h3>
    <p className="text-sm opacity-65">Обработка в едином серверном playout. Оригинальные файлы не меняются; новые параметры применяются со следующего трека.</p></div>
    <form onSubmit={save} className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(v=>({...v,enabled:e.target.checked}))}/> Включить обработку на сервере</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.normalization} onChange={e=>setSettings(v=>({...v,normalization:e.target.checked}))}/> Нормализация громкости (цель −16 LUFS)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.limiter} onChange={e=>setSettings(v=>({...v,limiter:e.target.checked}))}/> Ограничение пиков</label>
      <label className="block text-sm space-y-1"><span>Короткое затухание на границах</span>
        <select className="block w-full rounded-xl border border-current/20 bg-transparent px-3 py-2" value={settings.fadeMs} onChange={e=>setSettings(v=>({...v,fadeMs:Number(e.target.value)}))}>
          <option value={0}>Нет</option><option value={100}>100 мс</option><option value={250}>250 мс</option><option value={500}>500 мс</option>
        </select>
      </label>
      <p className="text-xs opacity-65">Это не перекрывающийся crossfade. Для точного старта запланированного эфира границы времени сохраняются. Проверьте настройки на тестовом приёмнике в наушниках.</p>
      {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
      {saved&&<p role="status" className="text-sm text-emerald-500">Настройки сохранены</p>}
      <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy?'Сохранение…':'Сохранить обработку звука'}</button>
    </form>
  </section>;
}
