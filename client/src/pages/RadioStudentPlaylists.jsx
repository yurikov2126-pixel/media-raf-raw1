import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useToast } from '../store/toast.jsx';

const duration = ms => {
  const seconds = Math.round((ms || 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const statuses = {
  DRAFT: 'Черновик', SUBMITTED: 'На проверке',
  APPROVED: 'Утверждён', RETURNED: 'На доработке',
};
const field = 'w-full rounded-xl border border-current/20 bg-transparent px-3 py-2.5 text-sm';

export default function RadioStudentPlaylists() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const dragged = useRef(null);
  const pointerDrag = useRef(null);
  const [dragTarget, setDragTarget] = useState(null);
  const call = useCallback((path, options) => api('/radio/student' + path, { token, ...options }), [token]);
  const refresh = useCallback(async () => {
    const [a, p] = await Promise.all([call('/assets'), call('/playlists')]);
    setAssets(a.assets || []);
    setPlaylists(p.playlists || []);
  }, [call]);
  useEffect(() => {
    let active = true;
    Promise.all([call('/assets'), call('/playlists')]).then(([a,p]) => {
      if (active) { setAssets(a.assets || []); setPlaylists(p.playlists || []); }
    }).catch(e => toast.error(e.message)).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [call,toast]);
  const reset = () => { setEditing(null); setName(''); setDescription(''); setSelected([]); if(searchParams.has('playlist')) setSearchParams({}, { replace: true }); };
  useEffect(() => {
    const id = searchParams.get('playlist');
    const playlist = playlists.find(p => p.id === id);
    if (playlist && ['DRAFT','RETURNED'].includes(playlist.status) && editing !== id) {
      setEditing(playlist.id); setName(playlist.name); setDescription(playlist.description || '');
      setSelected(playlist.items.map(item => item.assetId));
    }
  }, [playlists,searchParams,editing]);
  const edit = playlist => {
    setEditing(playlist.id);
    setName(playlist.name);
    setDescription(playlist.description || '');
    setSelected(playlist.items.map(item => item.assetId));
  };
  const save = async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await call(editing ? '/playlists/' + editing : '/playlists', {
        method: editing ? 'PUT' : 'POST', body: { name: name.trim(), description, assetIds: selected },
      });
      await refresh();
      reset();
      toast.success(response.playlist ? 'Плейлист сохранён' : 'Изменения сохранены');
    } catch(e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const submit = async playlist => {
    if (!window.confirm('Отправить плейлист «' + playlist.name + '» на проверку администратору?')) return;
    setBusy(true);
    try {
      await call('/playlists/' + playlist.id + '/submit', { method: 'POST' });
      await refresh();
      toast.success('Плейлист отправлен на проверку');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const reposition = (from, to) => {
    if (from == null || from === to || from < 0 || from >= selected.length) return;
    setSelected(previous => {
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  return <main className="mx-auto max-w-5xl space-y-4 p-3 pb-24 sm:p-6">
    <header className="space-y-1">
      <p className="text-xs uppercase tracking-widest opacity-55">MEDIA · РАФ · RAW / Радио</p>
      <h1 className="text-2xl font-bold">Мои плейлисты</h1>
      <p className="text-sm opacity-65">Составляйте музыкальные подборки и отправляйте их на проверку редактору эфира.</p>
    </header>
    {loading ? <p role="status">Загружаем аудиотеку…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2">
        {playlists.map(p => <article key={p.id} className="rounded-2xl border border-current/15 bg-white/5 p-4 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold break-words">{p.name}</h2>
            <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs">{statuses[p.status] || p.status}</span>
          </div>
          <p className="text-xs opacity-65">{p.items.length} записей · {duration(p.items.reduce((n,item)=>n+item.asset.durationMs,0))}</p>
          {p.status === 'RETURNED' && <p className="rounded-xl border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-300">Причина возврата: {p.reviewedReason}</p>}
          {['DRAFT','RETURNED'].includes(p.status) && <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => edit(p)} className="rounded-xl border border-current/20 px-3 py-2 text-sm">Редактировать</button>
            <button type="button" disabled={busy || !p.items.length} onClick={() => submit(p)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Отправить на проверку</button>
          </div>}
        </article>)}
      </div>
      <section className="rounded-2xl border border-current/15 bg-white/5 p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-semibold">{editing ? 'Редактирование плейлиста' : 'Новый плейлист'}</h2>
        <form className="space-y-3" onSubmit={save}>
          <label className="block space-y-1 text-sm"><span>Название</span><input className={field} required maxLength={140} value={name} onChange={e=>setName(e.target.value)} /></label>
          <label className="block space-y-1 text-sm"><span>Описание</span><textarea className={field} maxLength={2000} rows={2} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <div>
            <p className="text-sm font-medium">Аудиотека · нажмите для добавления</p>
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-current/10 p-2">
              {assets.filter(a=>!selected.includes(a.id)).map(a=><button key={a.id} type="button"
                onClick={()=>setSelected(previous=>[...previous,a.id])}
                className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left text-sm hover:bg-white/10">
                <span className="min-w-0 truncate">＋ {a.name}</span><span className="shrink-0 opacity-60">{duration(a.durationMs)}</span>
              </button>)}
              {assets.length===0 && <p className="text-sm opacity-60">В медиатеке пока нет записей.</p>}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Очередь · {selected.length} записей · {duration(selected.reduce((n,id)=>n+(assets.find(a=>a.id===id)?.durationMs || 0),0))}</p>
            <p className="mb-2 text-xs opacity-60">Перемещайте за ручку ⠿, на телефоне — удерживайте и перетаскивайте.</p>
            <div data-playlist-scroll className="max-h-[55vh] overflow-y-auto space-y-1">
              {selected.map((id,index)=><div key={id} onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();reposition(dragged.current,index);dragged.current=null;}}
                data-playlist-position={index}
                className={"flex items-center gap-2 rounded-xl border px-2 py-2 " + (dragTarget===index ? "border-blue-500 bg-blue-500/10" : "border-current/15")}>
                <span
                  onPointerDown={e=>{ if(e.button!==0) return; pointerDrag.current={from:index,pointerId:e.pointerId}; e.currentTarget.setPointerCapture(e.pointerId); setDragTarget(index); }}
                  onPointerMove={e=>{ if(pointerDrag.current?.pointerId!==e.pointerId)return;
                    const below=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-playlist-position]');
                    if(below)setDragTarget(Number(below.dataset.playlistPosition));
                    const scrollBox=e.currentTarget.closest('[data-playlist-scroll]');
                    if(scrollBox){ const rect=scrollBox.getBoundingClientRect();
                      if(e.clientY>rect.bottom-44) scrollBox.scrollTop+=18;
                      else if(e.clientY<rect.top+44) scrollBox.scrollTop-=18;
                    }
                  }}
                  onPointerUp={e=>{ const current=pointerDrag.current; if(current?.pointerId!==e.pointerId)return;
                    const below=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-playlist-position]');
                    const to=below?Number(below.dataset.playlistPosition):dragTarget;
                    pointerDrag.current=null;setDragTarget(null);if(Number.isInteger(to))reposition(current.from,to);
                  }}
                  onPointerCancel={()=>{pointerDrag.current=null;setDragTarget(null);}}
                  className="cursor-grab select-none rounded-lg p-2 touch-none active:cursor-grabbing"
                  role="button" tabIndex={0} aria-label="Перетащить запись">⠿</span>
                <span className="min-w-0 flex-1 truncate text-sm">{index+1}. {assets.find(a=>a.id===id)?.name || id}</span>
                <button type="button" onClick={()=>setSelected(old=>old.filter((_,i)=>i!==index))} aria-label="Убрать запись" className="rounded-lg border border-current/20 px-3 py-2">×</button>
              </div>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?'Сохранение…':'Сохранить черновик'}</button>
            {editing && <button type="button" className="rounded-xl border border-current/20 px-4 py-2.5 text-sm" onClick={reset}>Отмена</button>}
          </div>
        </form>
      </section>
    </>}
  </main>;
}
