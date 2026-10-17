import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/auth.jsx';
import { api } from '../api/client.js';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const fmt = ms => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dateLocal = value => new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

export default function Radio() {
  const { token } = useAuth();
  const [tab, setTab] = useState('home');
  const [assets, setAssets] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [files, setFiles] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0, failed: [] });
  const [playingId, setPlayingId] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const playerRef = useRef(null);
  const objectUrlRef = useRef('');
  const [wizard, setWizard] = useState(0);
  const [pickIds, setPickIds] = useState([]);
  const [pickSearch, setPickSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [slotPlaylist, setSlotPlaylist] = useState('');
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [repeatDays, setRepeatDays] = useState([]);
  const [slotTime, setSlotTime] = useState('');
  const [dragging, setDragging] = useState(null);
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
  const queueFiles = incoming => {
    const audio = [...incoming].filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f.name));
    setFiles(previous => {
      const keys = new Set(previous.map(f => f.name + '/' + f.size + '/' + f.lastModified));
      return [...previous, ...audio.filter(f => !keys.has(f.name + '/' + f.size + '/' + f.lastModified))];
    });
  };
  const upload = async () => {
    if (!files.length || uploading) return;
    setUploading(true); setError(''); setNotice('');
    const failures = []; let done = 0;
    setUploadProgress({ completed: 0, total: files.length, failed: [] });
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('filename', file.name);
        const res = await fetch(API + '/radio/assets', { method: 'POST',
          headers: { Authorization: 'Bearer ' + token }, body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw Error(json.error || 'Ошибка загрузки');
      } catch (e) { failures.push(file.name + ': ' + e.message); }
      done++;
      setUploadProgress({ completed: done, total: files.length, failed: [...failures] });
    }
    setFiles([]); setUploading(false);
    try { await refresh(); } catch (e) { setError(e.message); }
    setNotice('Обработано файлов: ' + done + '. Успешно: ' + (done - failures.length));
    if (failures.length) setError(failures.join(' · '));
  };
  const savePlaylist = () => action(async () => {
    await call(editing ? '/playlists/' + editing : '/playlists', {
      method: editing ? 'PUT' : 'POST', body: { name, description, assetIds: selected },
    });
    setEditing(null); setName(''); setDescription(''); setSelected([]); setWizard(0); setPickIds([]);
  });
  const reset = () => { setEditing(null); setName(''); setDescription(''); setSelected([]); setWizard(0); setPickIds([]); };
  const renameAsset = asset => {
    const name = window.prompt('Новое название записи', asset.name);
    if (name !== null && name.trim() && name.trim() !== asset.name) {
      action(() => call('/assets/' + asset.id, { method: 'PATCH', body: { name: name.trim() } }));
    }
  };
  const deleteAsset = asset => {
    if (window.confirm('Удалить запись «' + asset.name + '»? Это возможно только если она не входит в плейлист.')) {
      action(() => call('/assets/' + asset.id, { method: 'DELETE' }));
    }
  };
  const reorder = target => {
    if (dragging === null || dragging === target) return;
    setSelected(previous => {
      const next = [...previous];
      const [moved] = next.splice(dragging, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragging(null);
  };
  const startEdit = p => {
    setEditing(p.id); setName(p.name); setDescription(p.description);
    setSelected(p.items.map(i => i.assetId)); setWizard(1); setPickIds([]); setTab('playlists');
  };
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);
  const preview = async asset => {
    setError('');
    try {
      const response = await fetch(API + '/radio/assets/' + asset.id + '/audio',
        { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw Error('Не удалось загрузить запись');
      const blob = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setAudioUrl(url); setPlayingId(asset.id);
      // The shared player persists across track changes.
      requestAnimationFrame(() => playerRef.current?.play().catch(() => {}));
    } catch (e) { setError(e.message); }
  };
  const inputStyle = 'w-full rounded-xl border border-current/20 bg-transparent px-3 py-2 text-sm';
  const btn = 'rounded-xl px-4 py-2 text-sm font-semibold bg-blue-600 text-white disabled:opacity-50';
  return <main className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-widest opacity-60">MEDIA · РАФ · RAW</p>
      <h1 className="text-3xl font-bold">Радио</h1>
      <p className="opacity-70">Центр управления радиовещанием колледжа</p>
    </header>
    {tab === 'home' ? <>
      <section className="rounded-2xl border border-current/10 bg-white/5 p-5 space-y-2" aria-live="polite">
        <div className="flex justify-between gap-3 items-center flex-wrap">
          <h2 className="font-semibold">Эфирная система</h2>
          <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 px-3 py-1 text-xs font-medium">Настройка</span>
        </div>
        <p className="text-sm opacity-70">Воспроизведение и управление оборудованием ещё не активированы.</p>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          ['schedule','Сетка вещания','Единое расписание радиопрограмм и управления усилителем'],
          ['playlists','Плейлисты','Подготовка и согласование радиопередач'],
          ['studio','Эфирная студия','Прямые трансляции с мобильных устройств'],
          ['equipment','Оборудование','Windows Radio Agent, ESP32, усилитель AA-300'],
          ['history','История эфира','Отчёты о воспроизведении и событиях'],
        ].map(([id,title,description]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className="text-left rounded-2xl border border-current/10 bg-white/5 p-5 space-y-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm opacity-70">{description}</p>
            <p className="text-xs opacity-50">{id === 'schedule' || id === 'playlists' ? 'Открыть раздел →' : 'В разработке'}</p>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setTab('assets')} className="rounded-xl border border-current/15 px-4 py-2 text-sm">Аудиотека →</button>
    </> : <button type="button" onClick={() => setTab('home')} className="rounded-xl border border-current/15 px-4 py-2 text-sm">← Назад к Радио</button>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {notice && <p role="status" className="text-green-600 dark:text-green-400">{notice}</p>}
    {tab === 'assets' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Библиотека записей</h2>
      <div className="rounded-2xl border border-current/15 p-4 space-y-3">
        <div onDragEnter={e => { e.preventDefault(); setDropActive(true); }}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false); }}
          onDrop={e => { e.preventDefault(); setDropActive(false); queueFiles(e.dataTransfer.files); }}
          className={'border-2 border-dashed rounded-xl p-5 text-center space-y-2 ' + (dropActive ? 'border-blue-500 bg-blue-500/10' : 'border-current/20')}>
          <p className="font-medium">Перетащите аудиофайлы сюда</p>
          <p className="text-xs opacity-60">или выберите сразу несколько файлов · до 30 МБ каждый</p>
          <input id="radio-upload" type="file" multiple accept=".mp3,.wav,.ogg,.flac,.m4a" aria-label="Выбрать аудиофайлы"
            onChange={e => { queueFiles(e.target.files || []); e.target.value = ''; }} />
        </div>
        {files.length > 0 && <div className="space-y-2">
          <p className="text-sm">В очереди: {files.length}</p>
          {files.map((f,i)=><div key={f.name + i} className="flex justify-between gap-2 text-xs">
            <span className="truncate">{f.name}</span>
            <button disabled={uploading} className="underline" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}>Убрать</button>
          </div>)}
          <button className={btn} disabled={uploading} onClick={upload}>{uploading ? 'Загрузка…' : 'Загрузить ' + files.length + ' файлов'}</button>
        </div>}
        {uploadProgress.total>0 && <div role="status" className="text-sm">
          Загружено: {uploadProgress.completed} / {uploadProgress.total}
          <progress className="block w-full" max={uploadProgress.total} value={uploadProgress.completed}/>
        </div>}
      </div>
      <div className="rounded-2xl border border-current/10 p-4 space-y-2">
        <p className="font-semibold">Общий плеер</p>
        <p className="text-sm opacity-70">{assets.find(a=>a.id===playingId)?.name || 'Выберите запись ниже'}</p>
        <audio ref={playerRef} controls src={audioUrl || undefined} className="w-full" onEnded={() => setPlayingId(null)} />
      </div>
      <div className="space-y-2">{assets.map(a => <div key={a.id} className="flex items-center gap-3 justify-between border border-current/10 rounded-xl p-3">
        <div className="min-w-0"><p className="font-medium truncate">{a.name}</p><p className="text-xs opacity-60">{fmt(a.durationMs)} · {(a.byteSize / 1048576).toFixed(1)} МБ</p></div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => preview(a)}>Слушать</button>
          <button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={() => renameAsset(a)}>Переименовать</button>
          <button className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-500" onClick={() => deleteAsset(a)}>Удалить</button>
        </div>
      </div>)}</div>
    </section>}
    {tab === 'playlists' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Конструктор радиопрограмм</h2>
      {wizard === 0 ? <button className={btn} onClick={() => { reset(); setWizard(1); }}>+ Создать плейлист</button> : <form onSubmit={e => { e.preventDefault(); if (wizard===1) setWizard(2); else if (wizard===2) { setSelected(ids=>[...ids,...pickIds.filter(id=>!ids.includes(id))]); setPickIds([]); setWizard(3); } else savePlaylist(); }} className="rounded-2xl border border-current/10 p-4 space-y-3">
        <p className="text-xs opacity-60">Шаг {wizard} из 3 · {editing ? 'Редактирование' : 'Новый плейлист'}</p>
        {wizard===1 && <>
          <h3 className="font-semibold">1. Название и описание</h3>
          <input className={inputStyle} placeholder="Название передачи" required maxLength={140} value={name} onChange={e=>setName(e.target.value)}/>
          <textarea className={inputStyle} placeholder="Описание" maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/>
        </>}
        {wizard===2 && <>
          <h3 className="font-semibold">2. Выберите записи из аудиотеки</h3>
          <input className={inputStyle} placeholder="Найти запись" value={pickSearch} onChange={e=>setPickSearch(e.target.value)}/>
          <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={()=>setPickIds(assets.filter(a=>!selected.includes(a.id) && a.name.toLocaleLowerCase('ru').includes(pickSearch.toLocaleLowerCase('ru'))).map(a=>a.id))}>Выбрать все найденные</button>
          <div className="max-h-72 overflow-auto space-y-2">
            {assets.filter(a=>!selected.includes(a.id) && a.name.toLocaleLowerCase('ru').includes(pickSearch.toLocaleLowerCase('ru'))).map(a=><label key={a.id} className="flex items-center gap-3 rounded-lg border border-current/10 p-2 text-sm">
              <input type="checkbox" checked={pickIds.includes(a.id)} onChange={e=>setPickIds(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id))}/>
              <span className="flex-1 truncate">{a.name}</span><span className="opacity-60">{fmt(a.durationMs)}</span>
            </label>)}
          </div>
        </>}
        {wizard===3 && <>
          <h3 className="font-semibold">3. Порядок воспроизведения</h3>
          <p className="text-sm opacity-70">{selected.length} записей · {fmt(selected.reduce((sum,id)=>sum+(assets.find(a=>a.id===id)?.durationMs||0),0))}</p>
        {selected.map((id,index) => <div key={id} draggable onDragStart={() => setDragging(index)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); reorder(index); }} onDragEnd={() => setDragging(null)} className="flex gap-2 items-center rounded-lg border border-current/10 p-2" title="Перетащите для изменения порядка">
          <span className="flex-1 text-sm truncate">{index+1}. {assets.find(a=>a.id===id)?.name}</span>
          <button type="button" className="border border-current/20 rounded-lg px-2" disabled={index===0} onClick={()=>setSelected(s=>{const n=[...s];[n[index-1],n[index]]=[n[index],n[index-1]];return n;})}>↑</button>
          <button type="button" className="border border-current/20 rounded-lg px-2" disabled={index===selected.length-1} onClick={()=>setSelected(s=>{const n=[...s];[n[index+1],n[index]]=[n[index],n[index+1]];return n;})}>↓</button>
          <button type="button" className="border border-current/20 rounded-lg px-2" onClick={()=>setSelected(s=>s.filter((_,i)=>i!==index))}>×</button>
        </div>)}

          <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={()=>setWizard(2)}>+ Добавить ещё записи</button>
        </>}
        <div className="flex flex-wrap gap-2">
          {wizard>1 && <button type="button" className="rounded-xl border px-4 py-2" onClick={()=>setWizard(w=>w-1)}>Назад</button>}
          <button className={btn} disabled={wizard===3 && !selected.length}>{wizard===3 ? 'Сохранить плейлист' : 'Продолжить'}</button>
          <button type="button" className="rounded-xl border px-4 py-2" onClick={reset}>Отмена</button>
        </div>
      </form>}
      {playlists.map(p => <article key={p.id} className="rounded-2xl border border-current/10 p-4 space-y-2">
        <div className="flex gap-3 justify-between flex-wrap"><h3 className="font-semibold">{p.name}</h3><span className="text-xs opacity-70">{p.status==='APPROVED'?'Утверждён':'Черновик'}</span></div>
        <p className="text-sm opacity-70">{p.description}</p>
        <p className="text-xs opacity-60">{p.items.length} записей · {fmt(p.items.reduce((sum,i)=>sum+i.asset.durationMs,0))}</p>
        <div className="flex gap-2 flex-wrap">
          <button className={btn} onClick={()=>startEdit(p)}>Редактировать</button>{p.status!=='APPROVED' && <button className={btn} disabled={!p.items.length} onClick={()=>action(()=>call('/playlists/'+p.id+'/approve',{method:'POST'}))}>Утвердить</button>}
        </div>
      </article>)}
    </section>}
    {tab==='schedule' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Сетка вещания</h2>
      <label className="text-sm block">Начало периода <input type="date" className={inputStyle} value={date} onChange={e=>setDate(e.target.value)} /></label>
      <form onSubmit={e=>{e.preventDefault();action(()=>call(repeatWeeks > 1 ? '/schedule/weekly' : '/schedule',{method:'POST',body: repeatWeeks > 1 ? {playlistId:slotPlaylist,startAt:new Date(slotTime).toISOString(),weekdays:repeatDays,weeks:repeatWeeks} : {playlistId:slotPlaylist,startAt:new Date(slotTime).toISOString()}}));}} className="rounded-2xl border border-current/10 p-4 space-y-3">
        <h3 className="font-semibold">Добавить передачу</h3>
        <select required className={inputStyle} value={slotPlaylist} onChange={e=>setSlotPlaylist(e.target.value)}>
          <option value="">Выберите утверждённый плейлист</option>
          {playlists.filter(p=>p.status==='APPROVED').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input required className={inputStyle} type="datetime-local" aria-label="Дата и время эфира" value={slotTime} onChange={e=>setSlotTime(e.target.value)}/>
        <label className="text-sm block">Повторять в течение недель (1 — без повтора)
          <input className={inputStyle} type="number" min="1" max="12" value={repeatWeeks} onChange={e=>setRepeatWeeks(Number(e.target.value))}/>
        </label>
        {repeatWeeks > 1 && <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Дни недели для повтора (UTC, временный режим)</legend>
          <div className="flex gap-3 flex-wrap">{[['Вс',0],['Пн',1],['Вт',2],['Ср',3],['Чт',4],['Пт',5],['Сб',6]].map(([label,number])=>
            <label key={number} className="text-sm"><input type="checkbox" checked={repeatDays.includes(number)} onChange={e=>setRepeatDays(days=>e.target.checked?[...days,number]:days.filter(d=>d!==number))}/> {label}</label>)}
          </div>
          <p className="text-xs opacity-60">Повторы рассчитаны в UTC. Для окончательного эфирного расписания будет добавлен часовой пояс колледжа.</p>
        </fieldset>}
        <button disabled={repeatWeeks>1&&!repeatDays.length} className={btn}>Запланировать</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2" aria-label="Недельная сетка вещания">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(date + 'T00:00:00');
          day.setDate(day.getDate() + index);
          const daySlots = slots.filter(slot => new Date(slot.startAt).toDateString() === day.toDateString());
          return <section key={index} className="rounded-xl border border-current/10 bg-white/5 p-3 min-h-32">
            <h3 className="text-sm font-semibold mb-3">{day.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' })}</h3>
            {daySlots.map(slot => <div key={slot.id} className="mb-2 p-2 rounded-lg border-l-4 border-blue-500 bg-blue-500/10">
              <p className="text-xs font-bold">{new Date(slot.startAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p>
              <p className="text-xs break-words">{slot.playlist.name}</p>
            </div>)}
            {!daySlots.length && <p className="text-xs opacity-40">Свободно</p>}
          </section>;
        })}
      </div>
      {slots.length===0 && <p className="text-sm opacity-60">В выбранном периоде эфиров нет.</p>}
      {slots.map(s=><article key={s.id} className="rounded-2xl border border-current/10 p-4 flex items-center gap-3 justify-between">
        <div><h3 className="font-semibold">{s.playlist.name}</h3><p className="text-sm opacity-70">{dateLocal(s.startAt)} — {new Date(s.endAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p></div>
        {new Date(s.startAt)>new Date() && <button className="rounded-lg border border-red-500/30 px-3 py-2 text-red-500 text-sm" onClick={()=>{if(window.confirm('Удалить эфир?')) action(()=>call('/schedule/'+s.id,{method:'DELETE'}));}}>Удалить</button>}
      </article>)}
    </section>}
    {(tab==='studio'||tab==='equipment'||tab==='history') && <section className="rounded-2xl border border-current/10 p-6 space-y-2"><h2 className="text-xl font-bold">{tab==='studio'?'Эфирная студия':tab==='history'?'История эфира':'Оборудование'}</h2><p className="opacity-70">Подключение будет выполнено на следующем этапе. Сейчас оборудование не управляется.</p></section>}
  </main>;
}
