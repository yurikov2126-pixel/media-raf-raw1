import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/auth.jsx';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.jsx';
import RadioLiveStudio from '../components/RadioLiveStudio.jsx';
import RadioBroadcastDashboard from '../components/RadioBroadcastDashboard.jsx';
import RadioPlaylistReview from '../components/RadioPlaylistReview.jsx';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const fmt = ms => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const STATION_ZONE = 'Europe/Moscow';
const dateLocal = value => new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: STATION_ZONE });
const moscowDate = date => new Intl.DateTimeFormat('sv-SE', { timeZone: STATION_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export default function Radio() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState(() => ['playlists','schedule','assets','equipment','studio','history'].includes(new URLSearchParams(window.location.search).get('tab')) ? new URLSearchParams(window.location.search).get('tab') : 'home');
  const [assets, setAssets] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [folders, setFolders] = useState([]);
  const [openFolders, setOpenFolders] = useState({});
  const [dragPlaylistId, setDragPlaylistId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [radioDevices, setRadioDevices] = useState([]);
  const [deviceToken, setDeviceToken] = useState('');
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
  const [date, setDate] = useState(() => moscowDate(new Date()));
  const editRequestId = useRef(0);
  const call = useCallback((path, options) => api('/radio' + path, { token, ...options }), [token]);
  const refresh = useCallback(async () => {
    const from = new Date(date + 'T00:00:00+03:00');
    const to = new Date(from.getTime() + 7 * 86400000);
    const [a, p, s, f] = await Promise.all([
      call('/assets'), call('/playlists'),
      call('/schedule?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString())),
      call('/folders'),
    ]);
    setAssets(a.assets); setPlaylists(p.playlists); setSlots(s.slots); setFolders(f.folders);
  }, [call, date]);
  useEffect(() => { refresh().catch(e => toast.error(e.message)); }, [refresh]);
  const action = async (fn, successMessage = 'Изменения сохранены') => {
    try {
      await fn();
      await refresh();
      toast.success(successMessage);
    } catch (e) { toast.error(e.message || 'Не удалось выполнить действие'); }
  };
  const loadRadioDevices = async () => {
    try {
      const data = await api('/radio-agent/devices', { token });
      setRadioDevices(data.devices);
    } catch (e) { toast.error(e.message); }
  };
  const registerRadioDevice = async () => {
    const name = window.prompt('Название выделенного радиокомпьютера');
    if (!name?.trim()) return;
    try {
      const data = await api('/radio-agent/devices', { token, method: 'POST', body: { name: name.trim() } });
      setDeviceToken(data.token);
      await loadRadioDevices();
      toast.success('Радиокомпьютер зарегистрирован. Сохраните токен — повторно он не показывается.');
    } catch (e) { toast.error(e.message); }
  };
  const revokeRadioDevice = async device => {
    if (!window.confirm('Отключить радиокомпьютер «' + device.name + '»? Его токен перестанет работать.')) return;
    try {
      await api('/radio-agent/devices/' + device.id + '/revoke', { token, method: 'POST' });
      await loadRadioDevices();
      toast.success('Доступ радиокомпьютера отозван');
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { if (tab === 'equipment') loadRadioDevices(); }, [tab, token]);
  const setPilot = async (device, enabled) => {
    if (enabled && !window.confirm('Разрешить пробное воспроизведение через локальный аудиовыход Windows? Усилитель и ESP32 не управляются.')) return;
    try {
      await api('/radio-agent/devices/' + device.id + '/playback', {token,method:'POST',body:{enabled}});
      await loadRadioDevices();
      toast.success(enabled ? 'Тестовый вывод звука разрешён' : 'Тестовый вывод звука отключён');
    } catch (e) { toast.error(e.message); }
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
    setUploading(true);
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
    try { await refresh(); } catch (e) { toast.error(e.message); }
    if (done > failures.length) toast.success('Загружено файлов: ' + (done - failures.length));
    if (failures.length) toast.error('Ошибки загрузки: ' + failures.join(' · '));
  };
  const savePlaylist = () => action(async () => {
    await call(editing ? '/playlists/' + editing : '/playlists', {
      method: editing ? 'PUT' : 'POST', body: { name, description, assetIds: selected },
    });
    setEditing(null); setName(''); setDescription(''); setSelected([]); setWizard(0); setPickIds([]);
  });
  const reset = () => { editRequestId.current += 1; setEditing(null); setName(''); setDescription(''); setSelected([]); setWizard(0); setPickIds([]); };
  const createFolder = () => {
    const name = window.prompt('Название новой папки');
    if (name?.trim()) action(() => call('/folders', { method: 'POST', body: { name: name.trim() } }));
  };
  const renameFolder = folder => {
    const name = window.prompt('Название папки', folder.name);
    if (name?.trim() && name.trim() !== folder.name)
      action(() => call('/folders/' + folder.id, { method: 'PATCH', body: { name: name.trim() } }));
  };
  const removeFolder = folder => {
    if (window.confirm('Удалить папку «' + folder.name + '»? Плейлисты останутся в разделе «Без папки».'))
      action(() => call('/folders/' + folder.id, { method: 'DELETE' }));
  };
  const movePlaylist = (id, folderId) => {
    if (!id) return;
    setDragPlaylistId(null);
    action(() => call('/playlists/' + id + '/folder', { method: 'PATCH', body: { folderId } }));
  };
  const approvePlaylist = async playlist => {
    if (approvingId) return;
    setApprovingId(playlist.id);
    try {
      const response = await call('/playlists/' + playlist.id + '/approve', { method: 'POST' });
      if (response.playlist?.status !== 'APPROVED') throw Error('Сервер не подтвердил утверждение плейлиста');
      // Update immediately so the schedule selector can use it without a reload.
      setPlaylists(previous => previous.map(item => item.id === playlist.id ? response.playlist : item));
      await refresh();
      toast.success('Плейлист «' + playlist.name + '» утверждён и доступен в сетке вещания');
    } catch (e) {
      toast.error(e.message || 'Не удалось утвердить плейлист');
    } finally { setApprovingId(null); }
  };
  const deletePlaylist = playlist => {
    if (window.confirm('Удалить плейлист «' + playlist.name + '»? Это невозможно, если он используется в сетке вещания.'))
      action(() => call('/playlists/' + playlist.id, { method: 'DELETE' }));
  };
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
  const startEdit = async p => {
    const requestId = ++editRequestId.current;
    // Clear all old draft state before loading the selected playlist.
    setEditing(null); setSelected([]); setPickIds([]); setPickSearch('');
    setName(''); setDescription(''); setWizard(0);
    try {
      const { playlist } = await call('/playlists/' + encodeURIComponent(p.id));
      if (requestId !== editRequestId.current) return;
      if (playlist.id !== p.id) throw Error('Получены данные другого плейлиста');
      setEditing(playlist.id);
      setName(playlist.name);
      setDescription(playlist.description || '');
      setSelected(playlist.items.map(item => item.assetId));
      setWizard(1);
      setTab('playlists');
    } catch (e) { if (requestId === editRequestId.current) toast.error(e.message || 'Не удалось загрузить плейлист'); }
  };
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);
  const preview = async asset => {
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
    } catch (e) { toast.error(e.message); }
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
      <RadioBroadcastDashboard token={token} />
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
      <RadioPlaylistReview token={token} onChanged={refresh} />
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
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold">Плейлисты <span className="text-sm opacity-50">({playlists.length})</span></h3>
          <button type="button" className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={createFolder}>+ Новая папка</button>
        </div>
        {[{ id: null, name: 'Без папки' }, ...folders].map(folder => {
          const content = playlists.filter(p => (p.folderId || null) === folder.id);
          const expanded = folder.id === null || openFolders[folder.id] !== false;
          return <section key={folder.id || 'root'} className="rounded-xl border border-current/15 overflow-hidden"
            onDragOver={e => { if (dragPlaylistId) e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); if (dragPlaylistId) movePlaylist(dragPlaylistId, folder.id); }}>
            <div className="flex items-center justify-between gap-2 bg-white/5 px-3 py-2">
              <button type="button" className="flex-1 text-left text-sm font-semibold" onClick={() => folder.id && setOpenFolders(o=>({...o,[folder.id]:!expanded}))}>
                {expanded ? '▾' : '▸'} 📁 {folder.name} <span className="opacity-50">({content.length})</span>
              </button>
              {folder.id && <div className="flex items-center gap-2">
                <button type="button" className="text-xs opacity-70" onClick={()=>renameFolder(folder)}>Переименовать</button>
                <button type="button" className="text-xs text-red-500" onClick={()=>removeFolder(folder)}>Удалить папку</button>
              </div>}
            </div>
            {expanded && <div className="divide-y divide-current/10 min-h-10">
              {content.length===0 && <p className="px-3 py-3 text-xs opacity-50">Перетащите плейлист в эту папку</p>}
              {content.map(p => <div key={p.id} draggable
                onDragStart={e => { setDragPlaylistId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
                onDragEnd={() => setDragPlaylistId(null)}
                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2 items-center"><span className="cursor-grab opacity-50" title="Перетащить">⠿</span>
                    <span className="font-medium text-sm truncate">{p.name}</span>
                    <span className="shrink-0 text-xs opacity-50">{p.status==='APPROVED'?'Утверждён':p.status==='SUBMITTED'?'На проверке':p.status==='RETURNED'?'Возвращён':'Черновик'}</span></div>
                  <p className="ml-5 text-xs opacity-60 truncate">{p.items.length} записей · {fmt(p.items.reduce((sum,i)=>sum+i.asset.durationMs,0))}{p.description ? ' · ' + p.description : ''}</p>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <select aria-label={'Папка для ' + p.name} className="max-w-28 text-xs bg-transparent border border-current/20 rounded-lg px-1 py-2"
                    value={p.folderId || ''} onChange={e=>movePlaylist(p.id,e.target.value || null)}>
                    <option value="">Без папки</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button type="button" className="text-xs rounded-lg border border-current/20 px-2 py-2" onClick={()=>startEdit(p)}>Изменить</button>
                  {p.status==='SUBMITTED' && <button type="button" className="text-xs rounded-lg border border-current/20 px-2 py-2 disabled:opacity-50" disabled={!!approvingId} onClick={()=>approvePlaylist(p)}>{approvingId===p.id ? 'Утверждение…' : 'Утвердить'}</button>}
                  <button type="button" className="text-xs rounded-lg border border-red-500/30 text-red-500 px-2 py-2" onClick={()=>deletePlaylist(p)}>Удалить</button>
                </div>
              </div>)}
            </div>}
          </section>;
        })}
      </div>
    </section>}
    {tab==='schedule' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Сетка вещания</h2>
      <p className="text-sm opacity-70">Время радиостанции: Москва (UTC+3)</p>
      <label className="text-sm block">Начало периода <input type="date" className={inputStyle} value={date} onChange={e=>setDate(e.target.value)} /></label>
      <form onSubmit={e=>{e.preventDefault();
        const playlistId = slotPlaylist || (playlists.filter(p=>p.status==='APPROVED').length===1 ? playlists.find(p=>p.status==='APPROVED').id : '');
        if (!playlistId) { toast.error('Выберите утверждённый плейлист'); return; }
        if (!slotTime || new Date(slotTime + ':00+03:00').getTime() <= Date.now()) { toast.error('Укажите будущее время эфира по Москве'); return; }
        action(()=>call(repeatWeeks > 1 ? '/schedule/weekly' : '/schedule',{method:'POST',body: repeatWeeks > 1 ? {playlistId,startLocal:slotTime,weekdays:repeatDays,weeks:repeatWeeks} : {playlistId,startLocal:slotTime}}));
      }} className="rounded-2xl border border-current/10 p-4 space-y-3">
        <h3 className="font-semibold">Добавить передачу</h3>
        <select required className={inputStyle} value={slotPlaylist || (playlists.filter(p=>p.status==='APPROVED').length===1 ? playlists.find(p=>p.status==='APPROVED').id : '')} onChange={e=>setSlotPlaylist(e.target.value)}>
          <option value="">Выберите утверждённый плейлист</option>
          {playlists.filter(p=>p.status==='APPROVED').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input required className={inputStyle} type="datetime-local" aria-label="Дата и время эфира" value={slotTime} onChange={e=>setSlotTime(e.target.value)}/>
        <label className="text-sm block">Повторять в течение недель (1 — без повтора)
          <input className={inputStyle} type="number" min="1" max="12" value={repeatWeeks} onChange={e=>setRepeatWeeks(Number(e.target.value))}/>
        </label>
        {repeatWeeks > 1 && <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Дни недели (московское время)</legend>
          <div className="flex gap-3 flex-wrap">{[['Вс',0],['Пн',1],['Вт',2],['Ср',3],['Чт',4],['Пт',5],['Сб',6]].map(([label,number])=>
            <label key={number} className="text-sm"><input type="checkbox" checked={repeatDays.includes(number)} onChange={e=>setRepeatDays(days=>e.target.checked?[...days,number]:days.filter(d=>d!==number))}/> {label}</label>)}
          </div>
          <p className="text-xs opacity-60">Время и дни недели привязаны к часовому поясу радиостанции — Москва (UTC+3), независимо от устройства администратора.</p>
        </fieldset>}
        <button disabled={repeatWeeks>1&&!repeatDays.length} className={btn}>Запланировать</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2" aria-label="Недельная сетка вещания">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(date + 'T00:00:00+03:00');
          day.setUTCDate(day.getUTCDate() + index);
          const daySlots = slots.filter(slot => moscowDate(new Date(slot.startAt)) === moscowDate(day));
          return <section key={index} className="rounded-xl border border-current/10 bg-white/5 p-3 min-h-32">
            <h3 className="text-sm font-semibold mb-3">{day.toLocaleDateString('ru-RU', { timeZone: STATION_ZONE, weekday: 'short', day: '2-digit', month: '2-digit' })}</h3>
            {daySlots.map(slot => <div key={slot.id} className="mb-2 p-2 rounded-lg border-l-4 border-blue-500 bg-blue-500/10">
              <p className="text-xs font-bold">{new Date(slot.startAt).toLocaleTimeString('ru-RU',{timeZone: STATION_ZONE,hour:'2-digit',minute:'2-digit'})}</p>
              <p className="text-xs break-words">{slot.playlist.name}</p>
            </div>)}
            {!daySlots.length && <p className="text-xs opacity-40">Свободно</p>}
          </section>;
        })}
      </div>
      {slots.length===0 && <p className="text-sm opacity-60">В выбранном периоде эфиров нет.</p>}
      {slots.map(s=><article key={s.id} className="rounded-2xl border border-current/10 p-4 flex items-center gap-3 justify-between">
        <div><h3 className="font-semibold">{s.playlist.name}</h3><p className="text-sm opacity-70">{dateLocal(s.startAt)} — {new Date(s.endAt).toLocaleTimeString('ru-RU',{timeZone: STATION_ZONE,hour:'2-digit',minute:'2-digit'})}</p></div>
        {new Date(s.startAt)>new Date() && <button className="rounded-lg border border-red-500/30 px-3 py-2 text-red-500 text-sm" onClick={()=>{if(window.confirm('Удалить эфир?')) action(()=>call('/schedule/'+s.id,{method:'DELETE'}));}}>Удалить</button>}
      </article>)}
    </section>}
    {tab==='equipment' && <section className="rounded-2xl border border-current/10 p-5 space-y-4">
      <h2 className="text-xl font-bold">Оборудование · Windows Radio Agent</h2>
      <p className="text-sm opacity-70">Подключение пока только для синхронизации файлов и расписания. Воспроизведение и управление ESP32/AA-300 отключены.</p>
      <div className="flex gap-2 flex-wrap">
        <button className={btn} onClick={registerRadioDevice}>+ Зарегистрировать радиокомпьютер</button>
        <button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={loadRadioDevices}>Обновить список</button>
      </div>
      {deviceToken && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
        <p className="text-sm font-semibold">Токен показывается только сейчас. Не передавайте его в чат и не храните в публичных файлах.</p>
        <div className="flex flex-wrap gap-2"><input className={inputStyle} readOnly aria-label="Токен устройства" value={deviceToken}/>
          <button className={btn} onClick={()=>navigator.clipboard.writeText(deviceToken).then(()=>toast.success('Токен скопирован')).catch(()=>toast.error('Не удалось скопировать'))}>Копировать токен</button>
          <button className="rounded-xl border border-current/20 px-3" onClick={()=>setDeviceToken('')}>Скрыть</button></div>
      </div>}
      {radioDevices.map(d=><div key={d.id} className="rounded-xl border border-current/10 p-3 flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold text-sm">{d.name}</p>
          <p className="text-xs opacity-60">{d.revokedAt ? 'Отключён' : 'Зарегистрирован'} · Последняя связь: {d.lastSeenAt ? dateLocal(d.lastSeenAt) : 'пока не выходил на связь'}</p></div>
        {!d.revokedAt && <div className="flex flex-col sm:flex-row gap-2">
          <button className="rounded-lg border border-current/20 text-sm px-3 py-2" onClick={()=>setPilot(d,!d.playbackAllowed)}>
            {d.playbackAllowed ? 'Запретить тестовый эфир' : 'Разрешить тестовый эфир'}
          </button>
          <button className="rounded-lg border border-red-500/30 text-red-500 text-sm px-3 py-2" onClick={()=>revokeRadioDevice(d)}>Отключить</button>
        </div>}
      </div>)}
    </section>}
    {tab==='studio' && <RadioLiveStudio />}
    {tab==='history' && <section className="rounded-2xl border border-current/10 p-6 space-y-2">
      <h2 className="text-xl font-bold">История эфира</h2>
      <p className="opacity-70">В разработке.</p>
    </section>}
  </main>;
}
