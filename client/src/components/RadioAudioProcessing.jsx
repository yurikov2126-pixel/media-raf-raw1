import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function RadioAudioProcessing({token}) {
  const [settings,setSettings]=useState({enabled:false,loudnessTarget:-16,truePeak:-2,fadeMs:0,crossfadeMs:0});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const reload=useCallback(async()=>{
    try{const response=await api('/radio/audio-processing',{token});setSettings(response.settings);setError('');}
    catch(e){setError(e.message);}finally{setLoading(false);}
  },[token]);
  useEffect(()=>{reload();},[reload]);
  const save=async e=>{
    e.preventDefault();setSaving(true);setError('');setSuccess('');
    try{
      const response=await api('/radio/audio-processing',{token,method:'PUT',body:settings});
      setSettings(response.settings);
      setSuccess('Настройки сохранены. Изменения применятся к следующему запускаемому треку.');
    }catch(e){setError(e.message);}finally{setSaving(false);}
  };
  return <section className="rounded-2xl border border-current/15 radio-surface-soft p-4 sm:p-5 space-y-3">
    <h3 className="text-lg font-semibold">Обработка звука · серверный эфир</h3>
    <p className="text-sm opacity-70">Однопроходная нормализация громкости, контроль цифровых пиков и мягкое начало/окончание треков. Для начала проверьте наушниками в тестовом эфире.</p>
    {loading?<p role="status" className="text-sm">Загрузка настроек…</p>:<form onSubmit={save} className="space-y-3">
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))} className="h-5 w-5 accent-blue-600"/>Включить обработку звука</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-sm space-y-1"><span>Целевая громкость (LUFS)</span><select className="w-full rounded-xl border border-current/20 bg-transparent p-2.5" value={settings.loudnessTarget} onChange={e=>setSettings(s=>({...s,loudnessTarget:Number(e.target.value)}))}>{[-24,-22,-20,-18,-16,-14,-12].map(v=><option key={v} value={v}>{v} LUFS</option>)}</select></label>
        <label className="block text-sm space-y-1"><span>Потолок пиков (dBTP)</span><select className="w-full rounded-xl border border-current/20 bg-transparent p-2.5" value={settings.truePeak} onChange={e=>setSettings(s=>({...s,truePeak:Number(e.target.value)}))}>{[-6,-5,-4,-3,-2,-1].map(v=><option key={v} value={v}>{v} dBTP</option>)}</select></label>
        <label className="block text-sm space-y-1"><span>Fade в начале и конце</span><select className="w-full rounded-xl border border-current/20 bg-transparent p-2.5" value={settings.fadeMs} onChange={e=>setSettings(s=>({...s,fadeMs:Number(e.target.value)}))}>{[0,250,500,1000,1500,2000,3000].map(v=><option key={v} value={v}>{v===0?'Выключен':v+' мс'}</option>)}</select></label>
      </div>
      <label className="block max-w-xs text-sm space-y-1"><span>Crossfade Авто-DJ</span>
        <select className="w-full rounded-xl border border-current/20 bg-transparent p-2.5" value={settings.crossfadeMs??0} onChange={e=>setSettings(v=>({...v,crossfadeMs:Number(e.target.value)}))}>
          {[0,500,1000,1500,2000,3000,5000].map(v=><option key={v} value={v}>{v===0?'Выключен':(v/1000)+' с'}</option>)}
        </select>
      </label>
      <p className="text-xs opacity-60">Crossfade перекрывает соседние композиции Авто-DJ. Для запланированных передач перекрытие отключено; обработка двумя источниками требует дополнительного тестирования.</p>
      <p className="text-xs opacity-60">Fade — затухание отдельного трека, не crossfade между треками. Точность LUFS в однопроходном режиме приблизительная; исходные аудиофайлы не изменяются.</p>
      {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
      {success&&<p role="status" className="text-sm text-emerald-500">{success}</p>}
      <button disabled={saving} type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Сохранение…':'Сохранить обработку'}</button>
    </form>}
  </section>;
}
