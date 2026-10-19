import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.jsx';
import RadioLiveStudio from '../components/RadioLiveStudio.jsx';
import RadioControlRoom from '../components/RadioControlRoom.jsx';
import RadioAssetManager from '../components/RadioAssetManager.jsx';
import RadioScheduleBoard from '../components/RadioScheduleBoard.jsx';
import RadioSectionIntro from '../components/RadioSectionIntro.jsx';
import {RadioWorkspaceShell,RADIO_WORKSPACE_TABS} from '../components/RadioWorkspaceShell.jsx';
import '../styles/radio-workspace.css';
import RadioSourceControl from '../components/RadioSourceControl.jsx';
import RadioEsp32Registry from '../components/RadioEsp32Registry.jsx';
import RadioAutoDjSettings from '../components/RadioAutoDjSettings.jsx';
import RadioRotationSettings from '../components/RadioRotationSettings.jsx';
import RadioJingleSettings from '../components/RadioJingleSettings.jsx';
import RadioPlayoutHistory from '../components/RadioPlayoutHistory.jsx';
import RadioAudioProcessing from '../components/RadioAudioProcessing.jsx';
import RadioCueEditor from '../components/RadioCueEditor.jsx';
import RadioPlaylistReview from '../components/RadioPlaylistReview.jsx';
import RadioDurationTimeline from '../components/RadioDurationTimeline.jsx';
import { useRadioUploads } from '../components/RadioUploadManager.jsx';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const fmt = ms => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const STATION_ZONE = 'Europe/Moscow';
const dateLocal = value => new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: STATION_ZONE });
const moscowDate = date => new Intl.DateTimeFormat('sv-SE', { timeZone: STATION_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export default function Radio() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { addFiles, tasks: uploadTasks } = useRadioUploads();
  const [tab, setTab] = useState(() => RADIO_WORKSPACE_TABS.includes(new URLSearchParams(window.location.search).get('tab')) ? new URLSearchParams(window.location.search).get('tab') : 'home');
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab');
    if (RADIO_WORKSPACE_TABS.includes(requested)) setTab(requested);
  }, [location.search]);
  const [assets, setAssets] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [folders, setFolders] = useState([]);
  const [openFolders, setOpenFolders] = useState({});
  const [dragPlaylistId, setDragPlaylistId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [movingSlot,setMovingSlot] = useState(null);
  const [copyingSlot,setCopyingSlot] = useState(null);
  const [contextSlot,setContextSlot] = useState(null);
  const touchTimer=useRef(null);
  const touchPoint=useRef(null);
  const [moveTime,setMoveTime] = useState('');
  const [dragSlotId,setDragSlotId] = useState(null);
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
  const upload = () => { if (files.length) { addFiles(files, false); setFiles([]); } };
  const completedUploads = uploadTasks.filter(t => !t.student && t.status === 'done').length;
  useEffect(() => { if (completedUploads) refresh().catch(() => {}); }, [completedUploads]);
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
  const openSlotMenu = (slot) => { setContextSlot(slot); setMovingSlot(null); setCopyingSlot(null); };
  const startSlotTouch = (slot,e) => {
    if(e.touches.length!==1)return;
    touchPoint.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
    window.clearTimeout(touchTimer.current);
    touchTimer.current=window.setTimeout(()=>{openSlotMenu(slot);touchTimer.current=null;},550);
  };
  const cancelSlotTouch = () => {window.clearTimeout(touchTimer.current);touchTimer.current=null;touchPoint.current=null;};
  useEffect(()=>()=>window.clearTimeout(touchTimer.current),[]);
  const proposeCopy = slot => {
    setContextSlot(null);setCopyingSlot(slot);setMovingSlot(null);
    const time=new Date(slot.startAt).toLocaleTimeString('sv-SE',{timeZone:STATION_ZONE,hour:'2-digit',minute:'2-digit'});
    setMoveTime(moscowDate(new Date(Date.now()+86400000))+'T'+time);
  };
  const saveCopy = async e => {
    e.preventDefault();
    if(!copyingSlot||!moveTime)return;
    try {
      await call('/schedule',{method:'POST',body:{playlistId:copyingSlot.playlistId,startLocal:moveTime}});
      setCopyingSlot(null);await refresh();toast.success('Копия передачи добавлена в сетку');
    }catch(error){toast.error(error.message);}
  };
  const proposeMove = (slot, day) => {
    if (new Date(slot.startAt).getTime() <= Date.now()) return;
    const clock = new Date(slot.startAt).toLocaleTimeString('sv-SE',{timeZone:STATION_ZONE,hour:'2-digit',minute:'2-digit'});
    setMovingSlot(slot);setMoveTime(day+'T'+clock);
  };
  const saveMove = async e => {
    e.preventDefault();
    if(!movingSlot || !moveTime)return;
    const requested = new Date(moveTime+':00+03:00');
    if(!Number.isFinite(requested.getTime()) || requested.getTime()<=Date.now()){toast.error('Выберите будущее время');return;}
    const duration = new Date(movingSlot.endAt)-new Date(movingSlot.startAt);
    const clash = slots.some(s => s.id!==movingSlot.id &&
      new Date(s.startAt).getTime()<requested.getTime()+duration && new Date(s.endAt)>requested);
    if(clash){toast.error('Этот интервал пересекается с существующим эфиром');return;}
    try {
      await call('/schedule/'+movingSlot.id,{method:'PATCH',body:{startLocal:moveTime}});
      setMovingSlot(null);setDragSlotId(null);await refresh();
      toast.success('Передача перенесена');
    }catch(error){toast.error(error.message);}
  };
  const openWorkspace = next => {
    setTab(next);
    const url = new URL(window.location.href);
    if(next === 'home')url.searchParams.delete('tab');else url.searchParams.set('tab',next);
    window.history.replaceState(window.history.state,'',url.toString());
  };
  const inputStyle = 'w-full rounded-xl border border-current/20 bg-transparent px-3 py-2 text-sm';
  const btn = 'rounded-xl px-4 py-2 text-sm font-semibold bg-blue-600 text-white disabled:opacity-50';
  return <RadioWorkspaceShell tab={tab} onSelect={openWorkspace} stats={{assets:assets.length,playlists:playlists.length,slots:slots.length}}>
    {tab === 'home' && <RadioControlRoom token={token} onOpen={openWorkspace} />}
    {tab === 'automation' && <section className="space-y-5">
      <RadioSourceControl token={token}/>
      <RadioAutoDjSettings token={token} playlists={playlists}/>
      <RadioRotationSettings token={token} assets={assets}/>
      <RadioJingleSettings token={token} assets={assets}/>
    </section>}
    {tab === 'processing' && <section className="space-y-5">
      <RadioAudioProcessing token={token}/>
      <RadioCueEditor token={token} assets={assets}/>
    </section>}
    {tab === 'assets' && <RadioAssetManager assets={assets} token={token} refresh={refresh} preview={preview} rename={renameAsset} remove={deleteAsset} uploadPanel={<><details className="rounded-2xl border border-current/15 bg-white/50 p-4 dark:bg-slate-800/50" open={files.length>0||dropActive?true:undefined}>
        <summary className="cursor-pointer text-sm font-semibold">＋ Загрузить новые аудиозаписи</summary>
        <div className="mt-4 space-y-3">
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
      </details></>} player={<><div className="rounded-2xl border border-current/10 p-4 space-y-2">
        <p className="font-semibold">Общий плеер</p>
        <p className="text-sm opacity-70">{assets.find(a=>a.id===playingId)?.name || 'Выберите запись ниже'}</p>
        <audio ref={playerRef} controls src={audioUrl || undefined} className="w-full" onEnded={() => setPlayingId(null)} />
      </div></>} />}
    {tab === 'playlists' && <section className="space-y-4">
      <RadioPlaylistReview token={token} onChanged={refresh} />
      <RadioSectionIntro eyebrow="ПОДГОТОВКА" title="Конструктор радиопрограмм" description="Создавайте программы из записей, формируйте порядок воспроизведения, согласовывайте и размещайте в сетке." metrics={[{label:'Плейлистов',value:playlists.length},{label:'Утверждено',value:playlists.filter(p=>p.status==='APPROVED').length},{label:'Папок',value:folders.length}]}/>
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
      <RadioScheduleBoard slots={slots} date={date} onDateChange={setDate} onSelectSlot={openSlotMenu} onCreate={()=>document.getElementById('radio-schedule-create')?.setAttribute('open','')}/>
      <details id="radio-schedule-create" className="rounded-2xl border border-current/15 bg-white/50 p-4 dark:bg-slate-800/50">
        <summary className="cursor-pointer text-sm font-semibold">＋ Добавить передачу в расписание</summary>
      <form onSubmit={e=>{e.preventDefault();
        const playlistId = slotPlaylist || (playlists.filter(p=>p.status==='APPROVED').length===1 ? playlists.find(p=>p.status==='APPROVED').id : '');
        if (!playlistId) { toast.error('Выберите утверждённый плейлист'); return; }
        if (!slotTime || new Date(slotTime + ':00+03:00').getTime() <= Date.now()) { toast.error('Укажите будущее время эфира по Москве'); return; }
        action(()=>call(repeatWeeks > 1 ? '/schedule/weekly' : '/schedule',{method:'POST',body: repeatWeeks > 1 ? {playlistId,startLocal:slotTime,weekdays:repeatDays,weeks:repeatWeeks} : {playlistId,startLocal:slotTime}}));
      }} className="mt-4 space-y-3">
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
      </details>
      {contextSlot && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-3" onClick={()=>setContextSlot(null)}>
        <div role="dialog" aria-label="Действия с передачей" className="w-full max-w-sm space-y-3 rounded-2xl border border-current/20 bg-slate-100 p-4 text-slate-950 dark:bg-slate-900 dark:text-white" onClick={e=>e.stopPropagation()}>
          <h3 className="font-semibold">{contextSlot.playlist.name}</h3>
          <p className="text-sm opacity-60">{dateLocal(contextSlot.startAt)}</p>
          <button type="button" className="w-full rounded-xl border border-current/20 px-4 py-3 text-left" onClick={()=>proposeCopy(contextSlot)}>⧉ Копировать передачу</button>
          {new Date(contextSlot.startAt)>new Date()&&<button type="button" className="w-full rounded-xl border border-current/20 px-4 py-3 text-left" onClick={()=>{const slot=contextSlot;setContextSlot(null);proposeMove(slot,moscowDate(new Date(slot.startAt)));}}>↗ Перенести</button>}
          {new Date(contextSlot.startAt)>new Date()&&<button type="button" className="w-full rounded-xl border border-rose-500/40 px-4 py-3 text-left text-rose-600 dark:text-rose-300" onClick={()=>{const slot=contextSlot;setContextSlot(null);if(window.confirm('Удалить передачу из сетки?')) action(()=>call('/schedule/'+slot.id,{method:'DELETE'}));}}>Удалить передачу</button>}
          <button type="button" className="w-full rounded-xl border border-current/20 px-4 py-3 text-left" onClick={()=>setContextSlot(null)}>Закрыть</button>
        </div>
      </div>}
      {copyingSlot && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-3">
        <form onSubmit={saveCopy} className="w-full max-w-md space-y-3 rounded-2xl border border-current/20 bg-slate-100 p-5 text-slate-950 dark:bg-slate-900 dark:text-white">
          <h3 className="text-lg font-semibold">Копирование передачи</h3>
          <p className="text-sm opacity-70">{copyingSlot.playlist.name}</p>
          <label className="block space-y-1 text-sm">Дата и время копии · Москва UTC+3<input required type="datetime-local" className={inputStyle} value={moveTime} onChange={e=>setMoveTime(e.target.value)}/></label>
          <p className="text-xs opacity-60">Оригинальная передача сохранится. Занятые интервалы копировать нельзя.</p>
          <div className="flex gap-2"><button className={btn}>Создать копию</button><button type="button" className="rounded-xl border border-current/20 px-4 py-2" onClick={()=>setCopyingSlot(null)}>Отмена</button></div>
        </form>
      </div>}
      <details className="rounded-2xl border border-current/15 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Временная шкала · дополнительный вид</summary>
        <div className="mt-3"><RadioDurationTimeline weekStart={date} slots={slots} onOpen={openSlotMenu}/></div>
      </details>
      {movingSlot && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3">
        <form onSubmit={saveMove} className="w-full max-w-md rounded-2xl border border-current/15 bg-slate-100 p-5 text-slate-950 shadow-xl dark:bg-slate-900 dark:text-white space-y-3">
          <h3 className="text-lg font-semibold">Перенести передачу</h3>
          <p className="text-sm opacity-70">{movingSlot.playlist.name}</p>
          <label className="block space-y-1 text-sm">Новое начало · Москва UTC+3
            <input type="datetime-local" required className={inputStyle} value={moveTime} onChange={e=>setMoveTime(e.target.value)}/>
          </label>
          <p className="text-xs opacity-65">Продолжительность сохраняется. Пересечения с другими эфирами запрещены.</p>
          <div className="flex gap-2"><button type="submit" className={btn}>Сохранить перенос</button>
            <button type="button" className="rounded-xl border border-current/20 px-3 py-2" onClick={()=>setMovingSlot(null)}>Отмена</button></div>
        </form>
      </div>}
    </section>}
    {tab==='equipment' && <section className="rounded-2xl border border-current/10 p-5 space-y-4">
      <RadioSectionIntro eyebrow="ИНФРАСТРУКТУРА" title="Оборудование" description="Радиокомпьютеры, ESP32 и настройка локальной инфраструктуры. Управление питанием усилителя пока не активировано." metrics={[{label:'Устройств',value:radioDevices.length},{label:'Активных',value:radioDevices.filter(d=>!d.revokedAt).length}]}/>
      <p className="text-sm opacity-70">Радиокомпьютеры: синхронизация, резерв и разрешения на тестовый вывод звука. ESP32: регистрация и подготовка к сопряжению по локальной сети.</p>
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
      <RadioEsp32Registry token={token}/>
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
    {tab==='history' && <RadioPlayoutHistory token={token}/>}
  </RadioWorkspaceShell>;
}
