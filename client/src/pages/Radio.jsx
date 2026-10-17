import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../store/auth.jsx';
import { api } from '../api/client.js';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const fmt = ms => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dateLocal = value => new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

export default function Radio() {
  const { token } = useAuth();
  const [tab, setTab] = useState('schedule');
  const [assets, setAssets] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [slotPlaylist, setSlotPlaylist] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const call = useCallback((path, options) => api('/radio' + path, { token, ...options }), [token]);
  const refresh = useCallback(async () => {
    const from = new Date(date + 'T00:00:00');
    const to = new Date(from.getTime() + 7 * 86400000);
    const [a, p, s] = await Promise.all([
      call('/assets'), call('/playlists'),
      call('/schedule?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString())),
    ]);
    setAssets(a.assets); setPlaylists(p.playlists); setSlots(s.slots);
  }, [call, date]);
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
  const action = async fn => {
    setError(''); setNotice('');
    try { await fn(); await refresh(); setNotice('Изменения сохранены'); }
    catch (e) { setError(e.message); }
  };
  const upload = () => action(async () => {
    if (!file) throw Error('Выберите аудиофайл');
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(API + '/radio/assets', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw Error(result.error || 'Ошибка загрузки');
      setFile(null);
      const input = document.getElementById('radio-upload');
      if (input) input.value = '';
    } finally { setUploading(false); }
  });
  const savePlaylist = () => action(async () => {
    await call(editing ? '/playlists/' + editing : '/playlists', {
      method: editing ? 'PUT' : 'POST', body: { name, description, assetIds: selected },
    });
    setEditing(null); setName(''); setDescription(''); setSelected([]);
  });
  const reset = () => { setEditing(null); setName(''); setDescription(''); setSelected([]); };
  const startEdit = p => {
    setEditing(p.id); setName(p.name); setDescription(p.description);
    setSelected(p.items.map(i => i.assetId)); setTab('playlists');
  };
  const preview = async asset => {
    setError('');
    try {
      const response = await fetch(API + '/radio/assets/' + asset.id + '/audio', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw Error('Не удалось загрузить запись');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) { setError(e.message); }
  };
  const inputStyle = 'w-full rounded-xl border border-current/20 bg-transparent px-3 py-2 text-sm';
  const btn = 'rounded-xl px-4 py-2 text-sm font-semibold bg-blue-600 text-white disabled:opacity-50';
  return <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
    <header><p className="text-xs uppercase tracking-widest opacity-60">MEDIA · РАФ · RAW</p>
      <h1 className="text-3xl font-bold">Радио</h1>
      <p className="text-sm opacity-70">Планирование вещания · Только администратор</p></header>
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      Эфирный тракт пока не подключён. Расписание сохраняется, но не запускает усилитель или звук.
    </section>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {notice && <p role="status" className="text-green-600 dark:text-green-400">{notice}</p>}
    <nav className="flex flex-wrap gap-2" aria-label="Разделы радио">
      {[['schedule','Сетка вещания'],['playlists','Плейлисты'],['assets','Аудиотека'],['studio','Эфирная студия'],['equipment','Оборудование']].map(([id,title]) =>
        <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
          className={'rounded-xl px-3 py-2 text-sm border border-current/15 ' + (tab === id ? 'bg-blue-600 text-white' : 'bg-white/5')}>{title}</button>)}
    </nav>
    {tab === 'assets' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Библиотека записей</h2>
      <form className="rounded-2xl border border-current/10 p-4 flex flex-wrap gap-3 items-center"
        onSubmit={e => { e.preventDefault(); upload(); }}>
        <input id="radio-upload" aria-label="Аудиофайл" type="file" accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button className={btn} disabled={!file || uploading}>{uploading ? 'Загрузка…' : 'Загрузить запись'}</button>
        <p className="w-full text-xs opacity-60">MP3, WAV, OGG, FLAC, M4A; до 30 МБ. Длительность проверяется на сервере.</p>
      </form>
      <div className="space-y-2">{assets.map(a => <div key={a.id} className="flex items-center gap-3 justify-between border border-current/10 rounded-xl p-3">
        <div className="min-w-0"><p className="font-medium truncate">{a.name}</p><p className="text-xs opacity-60">{fmt(a.durationMs)} · {(a.byteSize / 1048576).toFixed(1)} МБ</p></div>
        <button className={btn} onClick={() => preview(a)}>Слушать</button>
      </div>)}</div>
    </section>}
    {tab === 'playlists' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Конструктор радиопрограмм</h2>
      <form onSubmit={e => { e.preventDefault(); savePlaylist(); }} className="rounded-2xl border border-current/10 p-4 space-y-3">
        <input className={inputStyle} placeholder="Название передачи" aria-label="Название передачи" required maxLength={140} value={name} onChange={e=>setName(e.target.value)}/>
        <textarea className={inputStyle} placeholder="Описание" aria-label="Описание передачи" maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/>
        <h3 className="font-semibold">Очередь записей · {fmt(selected.reduce((sum,id)=>sum+(assets.find(a=>a.id===id)?.durationMs||0),0))}</h3>
        {selected.map((id,index) => <div key={id} className="flex gap-2 items-center">
          <span className="flex-1 text-sm truncate">{index+1}. {assets.find(a=>a.id===id)?.name}</span>
          <button type="button" className="border border-current/20 rounded-lg px-2" disabled={index===0} onClick={()=>setSelected(s=>{const n=[...s];[n[index-1],n[index]]=[n[index],n[index-1]];return n;})}>↑</button>
          <button type="button" className="border border-current/20 rounded-lg px-2" disabled={index===selected.length-1} onClick={()=>setSelected(s=>{const n=[...s];[n[index+1],n[index]]=[n[index],n[index+1]];return n;})}>↓</button>
          <button type="button" className="border border-current/20 rounded-lg px-2" onClick={()=>setSelected(s=>s.filter((_,i)=>i!==index))}>×</button>
        </div>)}
        <select className={inputStyle} value="" aria-label="Добавить запись" onChange={e=>{if(e.target.value)setSelected(s=>[...s,e.target.value]);}}>
          <option value="">+ Добавить запись из аудиотеки</option>
          {assets.filter(a=>!selected.includes(a.id)).map(a=><option key={a.id} value={a.id}>{a.name} ({fmt(a.durationMs)})</option>)}
        </select>
        <div className="flex gap-2"><button className={btn}>{editing ? 'Сохранить изменения' : 'Создать плейлист'}</button>{editing && <button type="button" className="rounded-xl border px-4" onClick={reset}>Отмена</button>}</div>
      </form>
      {playlists.map(p => <article key={p.id} className="rounded-2xl border border-current/10 p-4 space-y-2">
        <div className="flex gap-3 justify-between flex-wrap"><h3 className="font-semibold">{p.name}</h3><span className="text-xs opacity-70">{p.status==='APPROVED'?'Утверждён':'Черновик'}</span></div>
        <p className="text-sm opacity-70">{p.description}</p>
        <p className="text-xs opacity-60">{p.items.length} записей · {fmt(p.items.reduce((sum,i)=>sum+i.asset.durationMs,0))}</p>
        <div className="flex gap-2 flex-wrap">
          {p.status!=='APPROVED' && <><button className={btn} onClick={()=>startEdit(p)}>Редактировать</button><button className={btn} disabled={!p.items.length} onClick={()=>action(()=>call('/playlists/'+p.id+'/approve',{method:'POST'}))}>Утвердить</button></>}
        </div>
      </article>)}
    </section>}
    {tab==='schedule' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Сетка вещания</h2>
      <label className="text-sm block">Начало периода <input type="date" className={inputStyle} value={date} onChange={e=>setDate(e.target.value)} /></label>
      <form onSubmit={e=>{e.preventDefault();action(()=>call('/schedule',{method:'POST',body:{playlistId:slotPlaylist,startAt:new Date(slotTime).toISOString()}}));}} className="rounded-2xl border border-current/10 p-4 space-y-3">
        <h3 className="font-semibold">Добавить передачу</h3>
        <select required className={inputStyle} value={slotPlaylist} onChange={e=>setSlotPlaylist(e.target.value)}>
          <option value="">Выберите утверждённый плейлист</option>
          {playlists.filter(p=>p.status==='APPROVED').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input required className={inputStyle} type="datetime-local" aria-label="Дата и время эфира" value={slotTime} onChange={e=>setSlotTime(e.target.value)}/>
        <button className={btn}>Запланировать</button>
      </form>
      {slots.length===0 && <p className="text-sm opacity-60">В выбранном периоде эфиров нет.</p>}
      {slots.map(s=><article key={s.id} className="rounded-2xl border border-current/10 p-4 flex items-center gap-3 justify-between">
        <div><h3 className="font-semibold">{s.playlist.name}</h3><p className="text-sm opacity-70">{dateLocal(s.startAt)} — {new Date(s.endAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p></div>
        {new Date(s.startAt)>new Date() && <button className="rounded-lg border border-red-500/30 px-3 py-2 text-red-500 text-sm" onClick={()=>{if(window.confirm('Удалить эфир?')) action(()=>call('/schedule/'+s.id,{method:'DELETE'}));}}>Удалить</button>}
      </article>)}
    </section>}
    {(tab==='studio'||tab==='equipment') && <section className="rounded-2xl border border-current/10 p-6 space-y-2"><h2 className="text-xl font-bold">{tab==='studio'?'Эфирная студия':'Оборудование'}</h2><p className="opacity-70">Подключение будет выполнено на следующем этапе. Сейчас оборудование не управляется.</p></section>}
  </main>;
}
