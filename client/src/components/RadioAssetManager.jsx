import {useEffect,useMemo,useRef,useState} from 'react';
import {api} from '../api/client.js';
import {radioFolderTree,radioFolderPath} from './radioFolderTree.js';
import RadioStorageAnalytics from './RadioStorageAnalytics.jsx';
import './radio-asset-manager-2.css';
const fmt=ms=>{const s=Math.floor((ms||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const size=b=>b>1048576?(b/1048576).toFixed(1)+' МБ':(b/1024).toFixed(0)+' КБ';
const name=a=>a.tags?.title?[a.tags.artist,a.tags.title].filter(Boolean).join(' — '):a.name;
const categoryOptions=[['MUSIC','Музыка'],['JINGLE','Джинглы'],['INTRO','Подводки'],['PROMO','Промо'],['EFFECT','Эффекты'],['OTHER','Прочее'],['SHOW','Передачи']];
const keys=['title','artist','album','genre','year','track','composer','comment'];
const labels={title:'Название',artist:'Исполнитель',album:'Альбом',genre:'Жанр',year:'Год',track:'Номер трека',composer:'Композитор',comment:'Комментарий'};
export default function RadioAssetManager({assets,token,refresh,preview,rename,remove,uploadPanel,player,onFolderChange}){
 const audioRef=useRef(null),urlRef=useRef(''),loadSeq=useRef(0),pendingSeek=useRef(null);
 const [activeId,setActiveId]=useState(null),[playState,setPlayState]=useState('idle'),[elapsed,setElapsed]=useState(0),[audioDuration,setAudioDuration]=useState(0);
 const [folders,setFolders]=useState([]),[folder,setFolder]=useState(null),[query,setQuery]=useState(''),[sort,setSort]=useState('name');
 const [collapsed,setCollapsed]=useState([]);
 const [advancedOpen,setAdvancedOpen]=useState(false),[artistFilter,setArtistFilter]=useState(''),[albumFilter,setAlbumFilter]=useState(''),[genreFilter,setGenreFilter]=useState(''),[durationFilter,setDurationFilter]=useState(''),[metadataFilter,setMetadataFilter]=useState('all');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(50),[results,setResults]=useState({assets:[],total:0,pages:1}),[loading,setLoading]=useState(false);
 const [fileDetails,setFileDetails]=useState(null);
 const [categoryFilter,setCategoryFilter]=useState(''),[categoryEditing,setCategoryEditing]=useState(null);
 const [checked,setChecked]=useState([]),[menu,setMenu]=useState(null),[dragOver,setDragOver]=useState(null);
 const [deleteReview,setDeleteReview]=useState(null),[reviewLoading,setReviewLoading]=useState(false);
 const [playlistName,setPlaylistName]=useState(''),[showPlaylist,setShowPlaylist]=useState(false);
 const [showBulkTags,setShowBulkTags]=useState(false),[bulkFields,setBulkFields]=useState({}),[bulkValues,setBulkValues]=useState({});
 const [view,setView]=useState('list'),[selected,setSelected]=useState(null),[moveItem,setMoveItem]=useState(null),[moveTarget,setMoveTarget]=useState(''),[tags,setTags]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const loadTrack=async(asset,seekSeconds=null)=>{
  const seq=++loadSeq.current;
  const audio=audioRef.current;
  if(audio)audio.pause();
  setActiveId(asset.id);setPlayState('loading');setElapsed(0);setAudioDuration((asset.durationMs||0)/1000);pendingSeek.current=seekSeconds;
  try{
   const response=await fetch((import.meta.env.VITE_API||'http://localhost:4000/api')+'/radio/assets/'+encodeURIComponent(asset.id)+'/audio',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw Error('Не удалось загрузить аудиозапись');
   const blob=await response.blob();
   if(seq!==loadSeq.current)return;
   const url=URL.createObjectURL(blob);
   if(urlRef.current)URL.revokeObjectURL(urlRef.current);
   urlRef.current=url;
   audio.src=url;
   audio.load();
   const seek=()=>{if(seq!==loadSeq.current)return;const desired=pendingSeek.current;if(Number.isFinite(desired)&&desired>=0)audio.currentTime=Math.min(desired,Math.max(0,audio.duration||desired));pendingSeek.current=null;audio.play().then(()=>{if(seq===loadSeq.current)setPlayState('playing');}).catch(()=>{if(seq===loadSeq.current)setPlayState('paused');});};
   if(audio.readyState>=1)seek();else audio.addEventListener('loadedmetadata',seek,{once:true});
  }catch(e){if(seq===loadSeq.current){setPlayState('error');setActiveId(null);setError(e.message||'Ошибка воспроизведения');}}
 };
 const toggleAudio=asset=>{
  if(activeId!==asset.id){void loadTrack(asset);return;}
  const audio=audioRef.current;if(!audio)return;
  if(!audio.src){void loadTrack(asset);return;}
  if(!audio.paused){audio.pause();setPlayState('paused');}
  else audio.play().then(()=>setPlayState('playing')).catch(()=>setPlayState('paused'));
 };
 const seekAudio=(asset,seconds)=>{
  if(activeId!==asset.id){void loadTrack(asset,seconds);return;}
  const audio=audioRef.current;
  if(audio?.src&&audio.readyState>=1){audio.currentTime=Math.max(0,Math.min(seconds,audio.duration||seconds));setElapsed(audio.currentTime);}
  else {pendingSeek.current=seconds;}
 };
 useEffect(()=>()=>{loadSeq.current++;audioRef.current?.pause();if(urlRef.current)URL.revokeObjectURL(urlRef.current);},[]);
 useEffect(()=>{if(activeId&&!list.some(a=>a.id===activeId)){audioRef.current?.pause();setPlayState('paused');}},[page,folder,query]);
 const request=(url,options)=>api('/radio'+url,{token,...options});
 const reload=async()=>{try{setFolders((await request('/asset-folders')).folders||[]);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{void reload();},[token]);
 useEffect(()=>{setPage(1);setChecked([]);},[folder,query,sort,pageSize,categoryFilter,artistFilter,albumFilter,genreFilter,durationFilter,metadataFilter]);
 useEffect(()=>{let alive=true;const controller=new AbortController();const timer=setTimeout(async()=>{
  setLoading(true);
  try{const p=new URLSearchParams({page:String(page),limit:String(pageSize),sort,query,category:categoryFilter,artist:artistFilter,album:albumFilter,genre:genreFilter,duration:durationFilter,metadata:metadataFilter});p.set('folderId',folder||'root');
   const data=await request('/assets/browse?'+p.toString(),{signal:controller.signal});
   if(alive){setResults(data);setError('');}
  }catch(e){if(alive)setError(e.message||'Не удалось загрузить записи');}finally{if(alive)setLoading(false);}
 },250);
 return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[token,page,pageSize,folder,query,sort,categoryFilter,artistFilter,albumFilter,genreFilter,durationFilter,metadataFilter,assets]);
 const tree=useMemo(()=>radioFolderTree(folders),[folders]);
 const ancestors=useMemo(()=>radioFolderPath(folders,folder),[folders,folder]);
 const visibleTree=tree.filter(entry=>!ancestorsHidden(entry));
 function ancestorsHidden(entry){
  let cursor=entry.parentId;const seen=new Set();
  while(cursor&&!seen.has(cursor)){if(collapsed.includes(cursor))return true;seen.add(cursor);cursor=folders.find(f=>f.id===cursor)?.parentId;}
  return false;
 }
 const chooseFolder=id=>{
  setFolder(id);
  onFolderChange?.(id,folders.find(f=>f.id===id)?.name||'Корень аудиотеки');
  if(id)setCollapsed(prev=>prev.filter(x=>!radioFolderPath(folders,id).some(a=>a.id===x)));
 };
 const childFolders=folders.filter(f=>(f.parentId||null)===folder);
 const list=results.assets||[];
 const selectedIds=checked.filter(id=>list.some(a=>a.id===id));
 const toggle=id=>setChecked(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const operation=async(fn)=>{setBusy(true);setError('');try{await fn();await refresh();await reload();}catch(e){setError(e.message||'Не удалось выполнить действие');}finally{setBusy(false);}};
 const addFolder=()=>{const title=window.prompt('Название папки');if(title?.trim())void operation(()=>request('/asset-folders',{method:'POST',body:{name:title.trim(),parentId:folder}}));};
 const setFolderCategory=(folder)=>{const category=window.prompt('Категория папки ('+categoryOptions.map(x=>x[0]).join(', ')+'). Пустое значение — Музыка:',folder.category||'');if(category===null)return;const chosen=category.trim().toUpperCase();if(chosen&&!categoryOptions.some(x=>x[0]===chosen)){setError('Неизвестная категория папки');return;}if(!window.confirm('Применить категорию ко всем существующим файлам папки и подпапок?'))return;void operation(()=>request('/asset-folders/'+folder.id,{method:'PATCH',body:{name:folder.name,category:chosen||null}}));};
 const reviewBulkDelete=async(ids=selectedIds)=>{
  if(!ids.length)return;
  setReviewLoading(true);setError('');
  try{const review=await request('/assets/bulk-delete-preview',{method:'POST',body:{assetIds:ids}});setDeleteReview(review);}
  catch(e){setError(e.message||'Не удалось проверить использование файлов');}
  finally{setReviewLoading(false);}
 };
 const confirmBulkDelete=async()=>{
  if(!deleteReview?.deletable?.length||busy)return;
  const ids=deleteReview.deletable.map(a=>a.id);
  await operation(async()=>{
   const result=await request('/assets/bulk-delete',{method:'POST',body:{assetIds:ids}});
   setDeleteReview(null);setChecked([]);
   setResults(prev=>({...prev,assets:prev.assets.filter(a=>!ids.includes(a.id)),total:Math.max(0,prev.total-ids.length)}));
   if(result.cleanupFailures)setError('Записи удалены из каталога, но часть файлов требует очистки на сервере: '+result.cleanupFailures);
  });
 };
 const assignCategory=()=>operation(async()=>{
  await request('/assets/categories',{method:'PATCH',body:{assetIds:categoryEditing.ids,category:categoryEditing.category}});
  setCategoryEditing(null);setChecked([]);
 });
 const moveAsset=a=>{setMoveItem(a);setMoveTarget(a.folderId||'');setMenu(null);};
 const moveMany=(ids,target)=>operation(async()=>{
  await request('/assets/bulk-move',{method:'POST',body:{assetIds:ids,folderId:target||null}});
  setChecked([]);setMenu(null);
 });
 const dropTo=(target,event)=>{
  event.preventDefault();setDragOver(null);
  let ids=[];try{ids=JSON.parse(event.dataTransfer.getData('application/x-radio-assets'));}catch{return;}
  if(!Array.isArray(ids)||!ids.length||ids.length>200)return;
  void moveMany(ids,target);
 };
 const startDrag=(a,event)=>{
  const ids=checked.includes(a.id)?checked:[a.id];
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('application/x-radio-assets',JSON.stringify(ids));
 };
 const createPlaylist=()=>operation(async()=>{
  const title=playlistName.trim();
  if(!title||!selectedIds.length)return;
  await request('/playlists',{method:'POST',body:{name:title,description:'Создан из аудиотеки',assetIds:selectedIds}});
  setChecked([]);setShowPlaylist(false);setPlaylistName('');
 });
 const saveMove=()=>{if(!moveItem)return;void operation(async()=>{if(moveItem.id)await request('/assets/'+moveItem.id+'/organize',{method:'PATCH',body:{folderId:moveTarget||null}});else await request('/assets/bulk-move',{method:'POST',body:{assetIds:selectedIds,folderId:moveTarget||null}});setMoveItem(null);setChecked([]);});};
 const openTags=a=>{setSelected(a);setTags(Object.fromEntries(keys.map(k=>[k,a.tags?.[k]||''])));};
 const saveTags=()=>{if(!selected)return;void operation(async()=>{await request('/assets/'+selected.id+'/tags',{method:'PATCH',body:{tags}});setSelected(null);});};
 const saveBulkTags=()=>operation(async()=>{
  const changes=Object.fromEntries(keys.filter(k=>bulkFields[k]).map(k=>[k,bulkValues[k]||'']));
  if(!Object.keys(changes).length)return;
  const result=await request('/assets/bulk-tags',{method:'PATCH',body:{assetIds:selectedIds,changes}});
  setShowBulkTags(false);setBulkFields({});setBulkValues({});setChecked([]);
  setResults(previous=>({...previous,assets:previous.assets.map(a=>selectedIds.includes(a.id)?{...a,tags:{...a.tags,...changes}}:a)}));
 });
 const rescan=a=>void operation(()=>request('/assets/'+a.id+'/rescan-tags',{method:'POST'}));
 return <section className="radio-library-v2 space-y-4">
  <audio ref={audioRef} className="hidden" preload="metadata" onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} onDurationChange={e=>setAudioDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0)} onEnded={()=>setPlayState('paused')} onError={()=>setPlayState('error')} aria-hidden="true"/>
  <div className="rl-hero flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 sm:p-6">
   <div><p className="rl-eyebrow">ПОЛИТЕХ-FM · МЕДИАТЕКА</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Аудиотека</h2>
    <p className="text-xs opacity-60">{assets.length} записей · {folders.length} папок · {size(assets.reduce((n,a)=>n+(a.byteSize||0),0))}</p></div>
   <div className="flex gap-2"><button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={addFolder} disabled={busy}>＋ Папка</button>
    <button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={reload}>↻</button></div>
  </div>
  <RadioStorageAnalytics token={token} revision={assets} onFolderOpen={chooseFolder} onReviewDelete={reviewBulkDelete}/>
  <div className="rl-upload">{uploadPanel}</div>
  <div className="rl-workspace grid gap-4 lg:grid-cols-[256px_minmax(0,1fr)]">
   <aside className="rl-sidebar rounded-2xl border p-3">
    <p className="px-2 py-2 text-xs uppercase tracking-widest opacity-55">Папки</p>
    <button onDragOver={e=>{e.preventDefault();setDragOver('root');}} onDragLeave={()=>setDragOver(null)} onDrop={e=>dropTo(null,e)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${dragOver==='root'?'ring-2 ring-indigo-500 ':''}${!folder?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} onClick={()=>chooseFolder(null)}>▣ Вся библиотека / корень</button>
    {visibleTree.map(f=><div key={f.id} className="mt-1 flex min-w-0 items-center" style={{paddingLeft:Math.min(f.depth,8)*12}}>
     {f.hasChildren?<button type="button" className="shrink-0 rounded-md px-1.5 py-2 text-xs hover:bg-indigo-500/10" aria-label={(collapsed.includes(f.id)?'Развернуть ':'Свернуть ')+f.name} aria-expanded={!collapsed.includes(f.id)} onClick={()=>setCollapsed(v=>v.includes(f.id)?v.filter(id=>id!==f.id):[...v,f.id])}>{collapsed.includes(f.id)?'▸':'▾'}</button>:<span aria-hidden="true" className="w-6 shrink-0"/>}
     <button type="button" onDragOver={e=>{e.preventDefault();setDragOver(f.id);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>dropTo(f.id,e)} onClick={()=>chooseFolder(f.id)} className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-sm ${dragOver===f.id?'ring-2 ring-indigo-500 ':''}${folder===f.id?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} title={f.name}>📁 {f.name} {f.category?'· '+(categoryOptions.find(x=>x[0]===f.category)?.[1]||f.category):''}</button>
    </div>)}

   </aside>
   <div className="min-w-0 space-y-3">
    <div className="rl-toolbar rounded-2xl border p-3 sm:p-4">
     <div className="flex flex-wrap items-center gap-2 text-xs">{[null,...ancestors].map((f,i)=><button key={f?.id||'root'} onClick={()=>chooseFolder(f?.id||null)} className="rounded-md px-2 py-1 hover:bg-indigo-500/10">{i?'› ':''}{f?.name||'Корень'}</button>)}</div>
     <div className="rl-searchbar mt-3 flex flex-wrap gap-2">
      <input className="min-w-32 flex-1 rounded-xl border border-current/15 bg-transparent px-3 py-2 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию, исполнителю, альбому, жанру"/>
      <select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-current/15 bg-transparent px-2 text-sm"><option value="name">Название А–Я</option><option value="recent">Новые сначала</option><option value="oldest">Старые сначала</option><option value="duration">Длинные сначала</option><option value="shortest">Короткие сначала</option><option value="largest">Крупные файлы</option></select>
      <button type="button" onClick={()=>setView(view==='list'?'tiles':'list')} className="rounded-xl border border-current/15 px-3 py-2 text-sm">{view==='list'?'Значки':'Список'}</button>
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2">
      <select aria-label="Тип контента" className="rounded-xl border border-current/15 bg-transparent p-2 text-sm" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Все категории</option>{categoryOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      <button type="button" aria-expanded={advancedOpen} className="rl-filter-toggle" onClick={()=>setAdvancedOpen(v=>!v)}>⚙ Фильтры {advancedOpen?'▲':'▼'}</button>
      <button type="button" className="rl-filter-toggle" onClick={()=>{setSort('recent');setMetadataFilter('all');setDurationFilter('');setArtistFilter('');setAlbumFilter('');setGenreFilter('');}}>Недавно добавленные</button>
      <button type="button" className="rl-filter-toggle" onClick={()=>{setMetadataFilter('no-artist');setAdvancedOpen(true);}}>Без исполнителя</button>
      <button type="button" className="rl-filter-toggle" onClick={()=>{setMetadataFilter('no-title');setAdvancedOpen(true);}}>Без названия</button>
      {(artistFilter||albumFilter||genreFilter||durationFilter||metadataFilter!=='all')&&<button type="button" className="rl-filter-clear" onClick={()=>{setArtistFilter('');setAlbumFilter('');setGenreFilter('');setDurationFilter('');setMetadataFilter('all');}}>Сбросить фильтры ✕</button>}
     </div>
     {advancedOpen&&<div className="rl-filter-panel mt-3 grid gap-2 rounded-xl p-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-xs font-semibold">Исполнитель<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2.5 text-sm" value={artistFilter} onChange={e=>setArtistFilter(e.target.value)} placeholder="Имя исполнителя"/></label>
      <label className="text-xs font-semibold">Альбом<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2.5 text-sm" value={albumFilter} onChange={e=>setAlbumFilter(e.target.value)} placeholder="Название альбома"/></label>
      <label className="text-xs font-semibold">Жанр<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2.5 text-sm" value={genreFilter} onChange={e=>setGenreFilter(e.target.value)} placeholder="Жанр"/></label>
      <label className="text-xs font-semibold">Продолжительность<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2.5 text-sm" value={durationFilter} onChange={e=>setDurationFilter(e.target.value)}><option value="">Любая</option><option value="short">До 3 минут</option><option value="medium">От 3 до 15 минут</option><option value="long">От 15 минут</option></select></label>
      <label className="text-xs font-semibold">Заполненность тегов<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2.5 text-sm" value={metadataFilter} onChange={e=>setMetadataFilter(e.target.value)}><option value="all">Любые записи</option><option value="no-artist">Без исполнителя</option><option value="no-title">Без названия</option></select></label>
     </div>}
     <div className="rl-selection mt-3 flex flex-wrap items-center gap-2 rounded-xl border p-2">
       <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(list.length)&&selectedIds.length===list.length} onChange={e=>setChecked(e.target.checked?list.map(a=>a.id):[])}/> Выбрать страницу</label>
       <span className="text-xs opacity-65">Выбрано: {selectedIds.length}</span>
       <button type="button" disabled={!selectedIds.length||busy} className="rl-bulk-tags-button" onClick={()=>{setBulkFields({});setBulkValues({});setShowBulkTags(true);}}>✎ Изменить теги</button>
       <button type="button" disabled={!selectedIds.length} onClick={()=>setShowPlaylist(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">＋ Плейлист из выбранных</button>
       <button type="button" disabled={!selectedIds.length} onClick={()=>{setMoveItem({id:null,name:selectedIds.length+' записей'});setMoveTarget(folder||'');}} className="rounded-lg border border-current/15 px-3 py-2 text-xs disabled:opacity-40">Переместить</button>
       <button type="button" disabled={!selectedIds.length||busy} className="rl-filter-toggle" onClick={()=>setCategoryEditing({ids:selectedIds,category:"MUSIC"})}>Изменить категорию</button>
       <button type="button" disabled={!selectedIds.length||busy||reviewLoading} onClick={()=>reviewBulkDelete()} className="rl-bulk-delete-btn">Проверить удаление</button>
       <span className="ml-auto text-xs opacity-60">{results.total} записей в папке</span>
     </div>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}
    {childFolders.length>0&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{childFolders.map(f=><div key={f.id} className="flex items-center gap-1 rounded-xl border border-current/10 radio-surface-soft0 p-2 dark:bg-slate-900/30">
     <button className="min-w-0 flex-1 truncate p-2 text-left text-sm" onDragOver={e=>e.preventDefault()} onDrop={e=>dropTo(f.id,e)} onClick={()=>chooseFolder(f.id)}>📁 {f.name}</button>
     <button title="Категория папки и подпапок" onClick={()=>setFolderCategory(f)}>🏷</button>
     <button title="Переименовать" onClick={()=>{const n=window.prompt('Название папки',f.name);if(n?.trim())void operation(()=>request('/asset-folders/'+f.id,{method:'PATCH',body:{name:n.trim()}}));}}>✎</button>
     <button title="Удалить пустую папку" onClick={()=>{if(window.confirm('Удалить пустую папку?'))void operation(()=>request('/asset-folders/'+f.id,{method:'DELETE'}));}}>×</button>
    </div>)}</div>}
    <div className={view==='tiles'?'rl-file-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4':'rl-file-list overflow-x-auto rounded-2xl border'}>
     {list.map(a=><article key={a.id} draggable onDragStart={e=>startDrag(a,e)} onContextMenu={e=>{e.preventDefault();setMenu({id:a.id,x:Math.min(e.clientX,window.innerWidth-205),y:Math.min(e.clientY,window.innerHeight-290)});}} className={view==='tiles'?'rl-file-card min-w-0 rounded-2xl border p-4':'rl-file-row flex min-w-[550px] items-center gap-3 border-b p-3 last:border-none'}>
      <input aria-label={'Выбрать '+name(a)} type="checkbox" checked={checked.includes(a.id)} onChange={()=>toggle(a.id)} />
      <div className="rl-file-art flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl">♫</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={name(a)}>{name(a)}</p>
       <p className="mt-1 truncate text-xs opacity-60">{[a.tags?.album,a.tags?.genre].filter(Boolean).join(' · ')||a.name}</p>
       <p className="rl-file-meta mt-2 text-xs tabular-nums opacity-70"><span>{fmt(a.durationMs)}</span><span>{size(a.byteSize)}</span></p></div>
      <div className="rl-inline-player" onClick={e=>e.stopPropagation()}>
       <button type="button" onClick={()=>toggleAudio(a)} aria-label={(activeId===a.id&&playState==='playing'?'Пауза: ':'Прослушать: ')+name(a)} title={activeId===a.id&&playState==='playing'?'Пауза':'Прослушать'} className="rl-play-toggle">{activeId===a.id&&playState==='loading'?'◌':activeId===a.id&&playState==='playing'?'Ⅱ':'▶'}</button>
       <div className="rl-seek-group">
        <input type="range" min={0} max={Math.max(1,activeId===a.id?audioDuration||a.durationMs/1000||1:a.durationMs/1000||1)} step={0.1}
         value={activeId===a.id?Math.min(elapsed,audioDuration||a.durationMs/1000||1):0}
         onChange={e=>seekAudio(a,Number(e.target.value))}
         aria-label={'Перемотка: '+name(a)} title="Нажмите на шкалу, чтобы перейти к нужному времени"/>
        <span className="rl-time-readout">{fmt((activeId===a.id?elapsed:0)*1000)} <span>/</span> {fmt((activeId===a.id&&audioDuration?audioDuration*1000:a.durationMs)||0)}</span>
       </div>
      </div>
      <div className="rl-row-actions flex gap-2">
       <button onClick={()=>toggleAudio(a)} title="Прослушать или поставить на паузу" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs rl-row-play-secondary">{activeId===a.id&&playState==='playing'?'Ⅱ':'▶'}</button>
       <button type="button" onClick={()=>setFileDetails(a)} title="Свойства файла" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">ⓘ</button>
       <button onClick={()=>setMenu({id:a.id,x:Math.max(8,window.innerWidth-230),y:Math.min(window.innerHeight-300,220)})} title="Действия" aria-label={'Меню '+name(a)} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs">⋯</button>
      </div>
     </article>)}
     {!list.length&&<div className="rl-empty col-span-full p-10 text-center"><div className="text-4xl">♫</div><strong className="mt-3 block text-base">Записей не найдено</strong><p className="mt-1 text-sm opacity-60">Попробуйте изменить запрос или выбрать другую папку.</p></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
      <span>Страница {page} из {results.pages||1} · Всего {results.total}</span>
      <div className="flex items-center gap-2">
       <select aria-label="Записей на странице" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} className="rounded-lg border border-current/15 bg-transparent p-2"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
       <button type="button" disabled={page<=1||loading} onClick={()=>setPage(v=>v-1)} className="rounded-lg border border-current/15 px-3 py-2 disabled:opacity-30">←</button>
       <button type="button" disabled={page>=results.pages||loading} onClick={()=>setPage(v=>v+1)} className="rounded-lg border border-current/15 px-3 py-2 disabled:opacity-30">→</button>
      </div>
    </div>
   </div>
  </div>
  {menu&&<><button type="button" aria-label="Закрыть контекстное меню" className="fixed inset-0 z-40" onClick={()=>setMenu(null)}/><div className="fixed z-50 w-48 space-y-1 rounded-xl border border-current/10 bg-white p-2 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white" style={{left:menu.x,top:menu.y}}>
   {(()=>{const a=list.find(x=>x.id===menu.id);if(!a)return null;return <>
    {[[ 'Прослушать',()=>preview(a) ],['Изменить категорию',()=>setCategoryEditing({ids:[a.id],category:a.category||'MUSIC'})],['Свойства файла',()=>setFileDetails(a)],['Изменить теги',()=>openTags(a)],['Считать ID3',()=>rescan(a)],['Переместить',()=>moveAsset(a)],['Переименовать',()=>rename(a)],['Удалить',()=>remove(a)]].map(([label,fn])=><button key={label} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-500/10" onClick={()=>{setMenu(null);fn();}}>{label}</button>)}
   </>;})()}
   </div></>}
  {categoryEditing&&<div className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-4" onClick={()=>setCategoryEditing(null)}><section className="rl-bulk-modal w-full max-w-md rounded-2xl p-5" role="dialog" aria-modal="true" aria-label="Изменить категорию" onClick={e=>e.stopPropagation()}><h3 className="text-lg font-bold">Категория аудиозаписей</h3><p className="my-3 text-sm">Выбрано: {categoryEditing.ids.length}</p><select className="w-full rounded-xl border border-current/20 bg-transparent p-3" value={categoryEditing.category} onChange={e=>setCategoryEditing(prev=>({...prev,category:e.target.value}))}>{categoryOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><div className="mt-4 flex justify-end gap-2"><button onClick={()=>setCategoryEditing(null)} className="rounded-lg border px-3 py-2">Отмена</button><button disabled={busy} onClick={assignCategory} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Сохранить</button></div></section></div>}
  {fileDetails&&<div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4" onClick={()=>setFileDetails(null)}>
   <section role="dialog" aria-modal="true" aria-label="Свойства аудиофайла" onClick={e=>e.stopPropagation()} className="rl-bulk-modal max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-2xl">
    <div className="flex items-center justify-between gap-2"><div><p className="rl-eyebrow">ФАЙЛОВЫЙ МЕНЕДЖЕР</p><h3 className="mt-1 text-xl font-bold">Свойства записи</h3></div><button type="button" onClick={()=>setFileDetails(null)} className="rounded-lg border border-current/20 px-3 py-2" aria-label="Закрыть">✕</button></div>
    <p className="mt-4 break-all text-sm font-bold">{name(fileDetails)}</p>
    <dl className="mt-4 grid grid-cols-[minmax(110px,1fr)_minmax(0,2fr)] gap-x-4 gap-y-3 text-sm">
     {[['Имя файла',fileDetails.name],['Продолжительность',fmt(fileDetails.durationMs)],['Размер',size(fileDetails.byteSize)],['Формат',fileDetails.mimeType||'—'],['Папка',folders.find(f=>f.id===fileDetails.folderId)?.name||'Корень аудиотеки'],['Исполнитель',fileDetails.tags?.artist||'—'],['Альбом',fileDetails.tags?.album||'—'],['Жанр',fileDetails.tags?.genre||'—'],['Категория',categoryOptions.find(x=>x[0]===(fileDetails.category||'MUSIC'))?.[1]||'Музыка'],['Дата добавления',fileDetails.createdAt?new Date(fileDetails.createdAt).toLocaleString('ru-RU'):'—']].map(([k,v])=><div className="contents" key={k}><dt className="opacity-60">{k}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>)}
    </dl>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={()=>{setFileDetails(null);openTags(fileDetails);}}>Изменить метаданные</button><button type="button" className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>setFileDetails(null)}>Закрыть</button></div>
   </section>
  </div>}
  {deleteReview&&<div className="fixed inset-0 z-[110] grid place-items-center bg-black/65 p-4" onClick={()=>setDeleteReview(null)}>
    <section role="dialog" aria-modal="true" aria-label="Проверка удаления аудиофайлов" className="rl-bulk-modal max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
     <div className="flex items-start justify-between gap-3"><div><p className="rl-eyebrow">ФАЙЛОВЫЙ МЕНЕДЖЕР · ПРОВЕРКА</p><h3 className="mt-1 text-xl font-bold">Безопасное удаление</h3></div><button type="button" aria-label="Закрыть" onClick={()=>setDeleteReview(null)} className="rounded-lg border border-current/20 px-3 py-2">✕</button></div>
     <p className="mt-3 text-sm">Проверено записей: <strong>{deleteReview.total}</strong>. Можно удалить: <strong>{deleteReview.deletable.length}</strong>. Используются в плейлистах: <strong>{deleteReview.blocked.length}</strong>.</p>
     <p className="mt-2 text-sm">Возможное освобождение: <strong>{size(deleteReview.reclaimBytes)}</strong>.</p>
     {deleteReview.blocked.length>0&&<div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"><strong className="text-sm">Защищённые записи не будут удалены</strong><ul className="mt-2 max-h-28 list-disc space-y-1 overflow-auto pl-5 text-xs">{deleteReview.blocked.map(a=><li key={a.id}>{a.name} · связей с плейлистами: {a.playlists}</li>)}</ul></div>}
     {deleteReview.deletable.length>0&&<div className="mt-3 rounded-xl border border-current/15 p-3"><strong className="text-sm">Будут удалены файлы и записи каталога</strong><ul className="mt-2 max-h-32 list-disc space-y-1 overflow-auto pl-5 text-xs">{deleteReview.deletable.map(a=><li key={a.id}>{a.name}</li>)}</ul></div>}
     <p className="mt-3 text-xs opacity-70">Перед удалением сервер ещё раз проверит связи. Восстановление файлов из этого окна не предусмотрено.</p>
     <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setDeleteReview(null)} className="rounded-xl border border-current/20 px-4 py-2.5 text-sm">Отмена</button><button type="button" disabled={busy||!deleteReview.deletable.length} onClick={confirmBulkDelete} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Удалить {deleteReview.deletable.length} файлов</button></div>
    </section>
   </div>}
  {showBulkTags&&<div className="fixed inset-0 z-[110] grid place-items-center bg-black/65 p-4" onClick={()=>setShowBulkTags(false)}>
   <div role="dialog" aria-modal="true" aria-label="Массовое изменение метаданных" onClick={e=>e.stopPropagation()} className="rl-bulk-modal w-full max-w-xl rounded-2xl p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div><p className="rl-eyebrow">АУДИОТЕКА · МАССОВЫЕ ДЕЙСТВИЯ</p><h3 className="mt-1 text-lg font-bold">Изменить метаданные</h3><p className="mt-1 text-xs opacity-70">Выбрано записей: {selectedIds.length}</p></div><button type="button" onClick={()=>setShowBulkTags(false)} aria-label="Закрыть" className="rounded-lg border border-current/20 px-3 py-2">✕</button></div>
    <p className="mt-4 rounded-xl border border-current/15 p-3 text-xs">Отметьте только те поля, которые нужно изменить. Остальные останутся прежними. Пустое значение в отмеченном поле очистит его у всех выбранных записей. Оригинальные аудиофайлы не меняются.</p>
    <div className="mt-4 grid max-h-[45vh] gap-3 overflow-y-auto sm:grid-cols-2">{keys.map(k=><div key={k} className="rounded-xl border border-current/15 p-3">
     <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!bulkFields[k]} onChange={e=>setBulkFields(old=>({...old,[k]:e.target.checked}))}/>{labels[k]}</label>
     <input className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm disabled:opacity-35" disabled={!bulkFields[k]} maxLength={k==='comment'?300:160} placeholder={bulkFields[k]?'Введите новое значение':'Без изменений'} value={bulkValues[k]||''} onChange={e=>setBulkValues(old=>({...old,[k]:e.target.value}))}/>
    </div>)}</div>
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={()=>setShowBulkTags(false)} className="rounded-xl border border-current/20 px-4 py-2.5 text-sm">Отмена</button><button type="button" disabled={busy||!selectedIds.length||!keys.some(k=>bulkFields[k])} onClick={saveBulkTags} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Применить к {selectedIds.length} записям</button></div>
   </div>
  </div>}
  {showPlaylist&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=>setShowPlaylist(false)}>
    <form onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();void createPlaylist();}} className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 dark:bg-slate-900 dark:text-white">
     <h3 className="text-lg font-bold">Плейлист из {selectedIds.length} записей</h3>
     <input autoFocus required maxLength={140} value={playlistName} onChange={e=>setPlaylistName(e.target.value)} placeholder="Название плейлиста" className="mt-4 w-full rounded-lg border border-current/15 bg-transparent p-3"/>
     <div className="mt-4 flex gap-2"><button disabled={busy} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Создать</button><button type="button" onClick={()=>setShowPlaylist(false)}>Отмена</button></div>
    </form>
   </div>}
  {moveItem&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=>setMoveItem(null)}>
   <div role="dialog" aria-modal="true" aria-label="Перемещение аудиофайла" onClick={e=>e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
    <h3 className="text-lg font-bold">Переместить запись</h3>
    <p className="mt-2 truncate text-sm opacity-65">{name(moveItem)}</p>
    <label className="mt-4 block text-sm font-semibold">Папка назначения
     <select value={moveTarget} onChange={e=>setMoveTarget(e.target.value)} className="mt-2 w-full rounded-xl border border-current/15 bg-transparent p-3">
      <option value="">Корень аудиотеки</option>
      {tree.map(f=><option key={f.id} value={f.id}>{'　'.repeat(Math.min(f.depth,8))}{f.name}</option>)}
     </select>
    </label>
    <div className="mt-5 flex gap-2"><button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" onClick={saveMove}>Переместить</button>
     <button className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>setMoveItem(null)}>Отмена</button></div>
   </div>
  </div>}
  {selected&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=>setSelected(null)}>
   <div role="dialog" aria-modal="true" aria-label="Редактор метаданных" onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
    <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Метаданные / ID3</h3><button onClick={()=>setSelected(null)} aria-label="Закрыть">✕</button></div>
    <p className="mt-2 truncate text-xs opacity-60">{selected.name}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{keys.map(k=><label key={k} className="text-xs font-medium">{labels[k]}<input value={tags[k]||''} onChange={e=>setTags(v=>({...v,[k]:e.target.value}))} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"/></label>)}</div>
    <p className="mt-3 text-xs opacity-60">Изменения сохраняются в каталоге радиостанции. Оригинальный аудиофайл и встроенные ID3-теги не перезаписываются.</p>
    <div className="mt-4 flex flex-wrap gap-2"><button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" disabled={busy} onClick={saveTags}>Сохранить теги</button>
     <button className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>{rescan(selected);setSelected(null);}}>Считать из файла</button>
     <button className="rounded-xl border border-current/20 px-4 py-2 text-sm" onClick={()=>setSelected(null)}>Отмена</button></div>
   </div>
  </div>}
 </section>;
}
