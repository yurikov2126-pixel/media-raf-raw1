import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
import RadioAutoPlaylistDraftEditor from './RadioAutoPlaylistDraftEditor.jsx';
const defaults={name:'',sourceFolderId:'',includeChildren:true,targetMinutes:60,trackOrder:'SMART',
 minTrackGap:20,minArtistGap:3,jingleAssetIds:[],jingleEvery:3,fadeMs:2000};
const field='w-full rounded-xl border border-current/20 bg-white/75 p-2.5 text-slate-900 dark:bg-slate-900/80 dark:text-slate-100';
const time=ms=>{const total=Math.round(ms/1000);return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');};
export default function RadioAutoPlaylistManager({token}){
 const [list,setList]=useState([]),[folders,setFolders]=useState([]),[assets,setAssets]=useState([]);
 const [current,setCurrent]=useState({...defaults}),[editing,setEditing]=useState(null);
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [open,setOpen]=useState(false);
 const [draftId,setDraftId]=useState(null);
 const call=useCallback((path,options)=>api('/radio'+path,{token,...options}),[token]);
 const reload=useCallback(async()=>{
  const [a,f,l]=await Promise.all([call('/assets'),call('/asset-folders'),call('/auto-playlists')]);
  setAssets(a.assets||[]);setFolders(f.folders||[]);setList(l.autoPlaylists||[]);
 },[call]);
 useEffect(()=>{reload().catch(e=>setError(e.message));},[reload]);
 const update=(key,value)=>{setCurrent(v=>({...v,[key]:value}));setPreview(null);setNotice('');};
 const create=()=>{setEditing(null);setCurrent({...defaults});setPreview(null);setError('');setOpen(true);};
 const edit=p=>{setEditing(p.id);setCurrent({...defaults,...p,jingleAssetIds:Array.isArray(p.jingleAssetIds)?p.jingleAssetIds:[]});setPreview(null);setError('');setOpen(true);};
 const execute=async action=>{setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e.message||'Ошибка запроса');}finally{setBusy(false);}};
 const save=e=>{e.preventDefault();execute(async()=>{
  await call(editing?'/auto-playlists/'+editing:'/auto-playlists',{method:editing?'PUT':'POST',body:current});
  await reload();setNotice('Настройки сохранены');setOpen(false);
 });};
 const generate=()=>execute(async()=>{
  const r=await call('/auto-playlists/preview',{method:'POST',body:current});
  setPreview(r.preview);
 });
 const remove=p=>{if(!window.confirm('Удалить настройки автоплейлиста «'+p.name+'»?'))return;
  execute(async()=>{await call('/auto-playlists/'+p.id,{method:'DELETE'});await reload();setNotice('Автоплейлист удалён');});
 };
 const number=(key,label,min,max,step=1)=><label className="block space-y-1 text-sm" key={key}>
  <span>{label}</span><input type="number" min={min} max={max} step={step} required value={current[key]}
   onChange={e=>update(key,e.target.value===''?'':Number(e.target.value))} className={field}/></label>;
 return <section className="space-y-4 rounded-2xl border border-current/15 radio-surface-soft p-4 sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-bold">Автоплейлисты</h2>
    <p className="mt-1 max-w-2xl text-sm opacity-70">Автоматически создавайте подборки из музыкальных папок. Пока только черновики и предпросмотр — действующий эфир не меняется.</p></div>
   <button type="button" onClick={create} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600">+ Автоплейлист</button>
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
  <div className="grid gap-3 md:grid-cols-2">
   {list.map(p=><article key={p.id} className="rounded-xl border border-current/15 p-3">
    <h3 className="font-semibold">{p.name}</h3>
    <p className="mt-1 text-xs opacity-70">{p.sourceFolder?.name||'Папка'} · {p.targetMinutes} мин · интервал по исполнителю {p.minArtistGap}</p>
    <div className="mt-3 flex gap-2">
     <button type="button" onClick={()=>{setDraftId(p.id);setOpen(false);}} className="rounded-lg border border-current/20 px-3 py-2 text-sm">Редактор</button>
     <button type="button" onClick={()=>edit(p)} className="rounded-lg border border-current/20 px-3 py-2 text-sm">Настроить</button>
     <button type="button" onClick={()=>remove(p)} disabled={busy} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">Удалить</button>
    </div>
   </article>)}
  </div>
  {!list.length&&!open&&<p className="rounded-xl border border-dashed border-current/20 p-5 text-center text-sm opacity-70">Автоплейлистов пока нет. Создайте первый из существующей папки аудиотеки.</p>}
  {draftId&&list.find(p=>p.id===draftId)&&<RadioAutoPlaylistDraftEditor token={token} config={list.find(p=>p.id===draftId)} assets={assets} onSaved={reload}/>}
  {open&&<form onSubmit={save} className="space-y-4 rounded-2xl border border-current/20 p-4">
   <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{editing?'Настройка автоплейлиста':'Создание автоплейлиста'}</h3>
    <button type="button" onClick={()=>setOpen(false)} className="rounded-lg border border-current/20 px-3 py-1.5 text-sm">Закрыть</button></div>
   <label className="block space-y-1 text-sm"><span>Название</span>
    <input className={field} required maxLength={140} value={current.name} onChange={e=>update('name',e.target.value)} placeholder="Дневной эфир"/></label>
   <label className="block space-y-1 text-sm"><span>Музыкальная папка</span>
    <select required className={field} value={current.sourceFolderId} onChange={e=>update('sourceFolderId',e.target.value)}>
     <option value="">Выберите папку</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
    </select></label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.includeChildren} onChange={e=>update('includeChildren',e.target.checked)}/>Учитывать подпапки</label>
   <div className="grid gap-3 sm:grid-cols-2">
    {number('targetMinutes','Длительность, мин',1,720)}
    <label className="block space-y-1 text-sm"><span>Режим ротации</span><select className={field} value={current.trackOrder} onChange={e=>update('trackOrder',e.target.value)}>
     <option value="SMART">Умная</option><option value="SHUFFLE">Случайная</option><option value="ORDERED">По порядку</option></select></label>
    {number('minTrackGap','Треков до повтора песни',0,1000)}
    {number('minArtistGap','Других песен до повтора исполнителя',0,1000)}
    {number('jingleEvery','Джингл каждые N песен (0 — выкл.)',0,50)}
    {number('fadeMs','Кроссфейд, мс',0,8000,100)}
   </div>
   <fieldset className="space-y-2"><legend className="text-sm font-semibold">Джинглы из аудиотеки</legend>
    <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-current/15 p-2">
     {assets.map(a=><label key={a.id} className="flex items-center gap-2 rounded-lg p-1 text-sm hover:bg-current/5">
      <input type="checkbox" checked={current.jingleAssetIds.includes(a.id)} onChange={e=>update('jingleAssetIds',e.target.checked?[...current.jingleAssetIds,a.id]:current.jingleAssetIds.filter(id=>id!==a.id))}/>
      <span className="min-w-0 truncate">{a.name}</span></label>)}
     {!assets.length&&<p className="text-sm opacity-60">Файлов пока нет</p>}
    </div>
   </fieldset>
   <div className="flex flex-wrap gap-2">
    <button type="submit" disabled={busy} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Сохранить настройки</button>
    <button type="button" onClick={generate} disabled={busy||!current.sourceFolderId||!current.name.trim()} className="rounded-xl border border-current/20 px-4 py-2 text-sm disabled:opacity-50">Предпросмотр подборки</button>
   </div>
   {preview&&<div className="space-y-2 rounded-xl border border-current/15 p-3">
    <p className="text-sm font-semibold">Предпросмотр · {preview.items.length} записей · {time(preview.durationMs)}</p>
    {!!preview.warnings?.length&&<p className="text-sm text-amber-700 dark:text-amber-300">Предупреждения: {preview.warnings.join(', ')}</p>}
    <ol className="max-h-80 space-y-1 overflow-auto text-sm">
     {preview.items.map((item,i)=><li key={i} className="flex gap-2 border-b border-current/10 py-1">
      <span className="w-7 shrink-0 opacity-50">{i+1}.</span><span className="min-w-0 flex-1 truncate">{assets.find(a=>a.id===item.assetId)?.name||item.assetId}</span>
      <span className="shrink-0 opacity-60">{item.kind==='JINGLE'?'Джингл':'Музыка'} · {time(item.durationMs)}</span></li>)}
    </ol></div>}
  </form>}
 </section>;
}
