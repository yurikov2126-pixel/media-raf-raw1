import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function RadioAutoDjSettings({ token, playlists=[] }) {
  const [config,setConfig]=useState({enabled:false,playlistId:null});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const approved=playlists.filter(p=>p.status==='APPROVED' && p.items?.length);
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const result=await api('/radio/autodj',{token});
      setConfig(result.settings);
      setError('');
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[token]);
  useEffect(()=>{load();},[load]);
  const save=async e=>{
    e.preventDefault();
    setSaving(true);setError('');setNotice('');
    try {
      const result=await api('/radio/autodj',{
        token,method:'PUT',body:{enabled:config.enabled,playlistId:config.playlistId||null}
      });
      setConfig(result.settings);
      setNotice(config.enabled?'Авто-DJ включён для серверного playout':'Авто-DJ отключён');
    } catch(e){setError(e.message);}
    finally{setSaving(false);}
  };
  return <section className="space-y-3 rounded-2xl border border-current/15 radio-surface-soft p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold">Авто-DJ · музыка между передачами</h3>
        <p className="mt-1 text-sm opacity-65">Когда в сетке нет передачи, серверный playout воспроизводит утверждённый музыкальный плейлист.</p>
      </div>
      <span className={'rounded-full border px-3 py-1 text-xs '+(config.enabled?'border-emerald-500/40 text-emerald-600 dark:text-emerald-400':'border-current/15 opacity-60')}>
        {config.enabled?'Разрешён':'Выключен'}
      </span>
    </div>
    {loading?<p role="status" className="text-sm">Загрузка настроек…</p>:
    <form onSubmit={save} className="space-y-3">
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={config.enabled} onChange={e=>setConfig(v=>({...v,enabled:e.target.checked}))} className="h-5 w-5 accent-blue-600"/>
        Заполнять паузы в сетке автоматически
      </label>
      <label className="block space-y-1 text-sm"><span>Музыкальный плейлист</span>
        <select className="w-full rounded-xl border border-current/20 bg-transparent px-3 py-2.5" value={config.playlistId||''}
          onChange={e=>setConfig(v=>({...v,playlistId:e.target.value||null}))}>
          <option value="">Выберите утверждённый плейлист</option>
          {approved.map(p=><option key={p.id} value={p.id}>{p.name} · {p.items.length} записей</option>)}
        </select>
      </label>
      <p className="text-xs opacity-65">Запланированные эфиры имеют приоритет. Музыка автоматически остановится в момент начала передачи. Физический аудиовыход агента, усилитель и ESP32 здесь не включаются.</p>
      {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice&&<p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      <button type="submit" disabled={saving||(config.enabled&&!config.playlistId)}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
        {saving?'Сохранение…':'Сохранить настройки Авто-DJ'}
      </button>
    </form>}
  </section>;
}
