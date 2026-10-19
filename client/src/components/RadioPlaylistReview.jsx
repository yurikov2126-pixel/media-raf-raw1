import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.jsx';
import { useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import RadioTrackPlayer from './RadioTrackPlayer.jsx';

export default function RadioPlaylistReview({ token, onChanged }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('playlist');
  const selectedRef = useRef(null);
  const [previewId,setPreviewId] = useState(null);
  const [pending, setPending] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    const response = await api('/radio/playlists', { token });
    setPending((response.playlists || []).filter(p => p.status === 'SUBMITTED'));
  }, [token]);
  useEffect(() => { load().catch(e => toast.error(e.message)); }, [load,toast]);
  useEffect(()=>{ if(selectedId && pending.some(p=>p.id===selectedId)) selectedRef.current?.scrollIntoView({behavior:'smooth',block:'center'}); },[selectedId,pending]);
  const decide = async (playlist, approved) => {
    if (!approved && !reasons[playlist.id]?.trim()) {
      toast.error('Укажите причину возврата');
      return;
    }
    setBusy(playlist.id);
    try {
      const endpoint = approved ? 'approve' : 'return';
      await api('/radio/playlists/' + playlist.id + '/' + endpoint, {
        token, method: 'POST', ...(approved ? {} : { body: { reason: reasons[playlist.id].trim() } }),
      });
      await load();
      await onChanged?.();
      toast.success(approved ? 'Студенческий плейлист утверждён' : 'Плейлист возвращён с причиной');
    } catch (error) { toast.error(error.message); }
    finally { setBusy(null); }
  };
  return <section className="space-y-3 rounded-2xl border border-current/15 radio-surface-soft p-3 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-semibold">Проверка студенческих плейлистов <span className="opacity-60">({pending.length})</span></h2>
      <button type="button" onClick={()=>load().catch(e=>toast.error(e.message))}
        className="rounded-lg border border-current/20 px-3 py-2 text-xs">Обновить</button>
    </div>
    {!pending.length && <p className="text-sm opacity-65">Плейлистов на проверке нет.</p>}
    {pending.map(p=><article key={p.id} ref={p.id===selectedId?selectedRef:null} className={"space-y-3 rounded-xl border p-3 "+(p.id===selectedId?"border-blue-500 bg-blue-500/10":"border-current/15")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-medium break-words">{p.name}</h3>
          <p className="text-xs opacity-65">Автор: {p.createdBy} · {p.items.length} записей</p>
        </div>
        <span className="rounded-full border border-amber-500/40 px-2 py-1 text-xs">На проверке</span>
      </div>
      {p.description && <p className="text-sm opacity-70">{p.description}</p>}
      <details className="rounded-lg border border-current/10 p-2 text-sm">
        <summary className="cursor-pointer">Состав плейлиста</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">{p.items.map(i=><li key={i.id}>{i.asset.name}</li>)}</ol>
      </details>
      <button type="button" onClick={()=>setPreviewId(current=>current===p.id?null:p.id)} className="rounded-xl border border-current/20 px-3 py-2 text-sm">♫ {previewId===p.id?'Закрыть плеер':'Прослушать плейлист'}</button>
      {previewId===p.id&&<RadioTrackPlayer token={token} tracks={p.items.map(i=>i.asset)}/>}
      <label className="block space-y-1 text-sm"><span>Причина возврата (обязательна при отклонении)</span>
        <textarea className="w-full rounded-xl border border-current/20 bg-transparent p-2 text-sm" rows={2}
          maxLength={1000} value={reasons[p.id] || ''} onChange={e=>setReasons(current=>({...current,[p.id]:e.target.value}))}
          placeholder="Опишите, что студенту нужно исправить"/>
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy!==null} type="button" onClick={()=>decide(p,true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Утвердить</button>
        <button disabled={busy!==null || !reasons[p.id]?.trim()} type="button" onClick={()=>decide(p,false)}
          className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm disabled:opacity-50">Вернуть на доработку</button>
      </div>
    </article>)}
  </section>;
}
