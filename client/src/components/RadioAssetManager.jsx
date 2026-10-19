import {useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
const fmt=ms=>{const s=Math.floor((ms||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const size=b=>b>1048576?(b/1048576).toFixed(1)+' МБ':(b/1024).toFixed(0)+' КБ';
const name=a=>a.tags?.title?[a.tags.artist,a.tags.title].filter(Boolean).join(' — '):a.name;
const keys=['title','artist','album','genre','year','track','composer','comment'];
const labels={title:'Название',artist:'Исполнитель',album:'Альбом',genre:'Жанр',year:'Год',track:'Номер трека',composer:'Композитор',comment:'Комментарий'};
export default function RadioAssetManager({assets,token,refresh,preview,rename,remove,uploadPanel,player}){
 const [folders,setFolders]=useState([]),[folder,setFolder]=useState(null),[query,setQuery]=useState(''),[sort,setSort]=useState('name');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(50),[results,setResults]=useState({assets:[],total:0,pages:1}),[loading,setLoading]=useState(false);
 const [checked,setChecked]=useState([]),[menu,setMenu]=useState(null),[dragOver,setDragOver]=useState(null);
 const [playlistName,setPlaylistName]=useState(''),[showPlaylist,setShowPlaylist]=useState(false);
 const [view,setView]=useState('list'),[selected,setSelected]=useState(null),[moveItem,setMoveItem]=useState(null),[moveTarget,setMoveTarget]=useState(''),[tags,setTags]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=(url,options)=>api('/radio'+url,{token,...options});
 const reload=async()=>{try{setFolders((await request('/asset-folders')).folders||[]);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{void reload();},[token]);
 useEffect(()=>{setPage(1);setChecked([]);},[folder,query,sort,pageSize]);
 useEffect(()=>{let alive=true;const controller=new AbortController();const timer=setTimeout(async()=>{
  setLoading(true);
  try{const p=new URLSearchParams({page:String(page),limit:String(pageSize),sort,query});if(folder)p.set('folderId',folder);
   const data=await request('/assets/browse?'+p.toString(),{signal:controller.signal});
   if(alive){setResults(data);setError('');}
  }catch(e){if(alive)setError(e.message||'Не удалось загрузить записи');}finally{if(alive)setLoading(false);}
 },250);
 return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[token,page,pageSize,folder,query,sort,assets]);
 const current=folders.find(f=>f.id===folder);
 const ancestors=[];let pointer=current;
 while(pointer&&ancestors.length<12){if(ancestors.includes(pointer))break;ancestors.unshift(pointer);pointer=folders.find(f=>f.id===pointer.parentId);}
 const childFolders=folders.filter(f=>(f.parentId||null)===folder);
 const list=results.assets||[];
 const selectedIds=checked.filter(id=>list.some(a=>a.id===id));
 const toggle=id=>setChecked(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const operation=async(fn)=>{setBusy(true);setError('');try{await fn();await refresh();await reload();}catch(e){setError(e.message||'Не удалось выполнить действие');}finally{setBusy(false);}};
 const addFolder=()=>{const title=window.prompt('Название папки');if(title?.trim())void operation(()=>request('/asset-folders',{method:'POST',body:{name:title.trim(),parentId:folder}}));};
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
 const rescan=a=>void operation(()=>request('/assets/'+a.id+'/rescan-tags',{method:'POST'}));
 return <section className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-current/10 bg-white/60 p-4 dark:bg-slate-900/40">
   <div><p className="text-xs font-semibold uppercase tracking-widest opacity-55">Аудиотека / Файловый менеджер</p><h2 className="mt-1 text-xl font-bold">Медиабиблиотека станции</h2>
    <p className="text-xs opacity-60">{assets.length} записей · {folders.length} папок · {size(assets.reduce((n,a)=>n+(a.byteSize||0),0))}</p></div>
   <div className="flex gap-2"><button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={addFolder} disabled={busy}>＋ Папка</button>
    <button className="rounded-xl border border-current/20 px-3 py-2 text-sm" onClick={reload}>↻</button></div>
  </div>
  {uploadPanel}
  <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
   <aside className="rounded-2xl border border-current/10 radio-surface-soft0 p-3 dark:bg-slate-900/40">
    <p className="px-2 py-2 text-xs uppercase tracking-widest opacity-55">Папки</p>
    <button onDragOver={e=>{e.preventDefault();setDragOver('root');}} onDragLeave={()=>setDragOver(null)} onDrop={e=>dropTo(null,e)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${dragOver==='root'?'ring-2 ring-indigo-500 ':''}${!folder?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} onClick={()=>setFolder(null)}>▣ Вся библиотека / корень</button>
    {folders.map(f=><button key={f.id} onDragOver={e=>{e.preventDefault();setDragOver(f.id);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>dropTo(f.id,e)} onClick={()=>setFolder(f.id)} className={`mt-1 block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${folder===f.id?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} title={f.name}>▸ {f.name}</button>)}

   </aside>
   <div className="min-w-0 space-y-3">
    <div className="rounded-xl border border-current/10 radio-surface-soft0 p-3 dark:bg-slate-900/40">
     <div className="flex flex-wrap items-center gap-2 text-xs">{[null,...ancestors].map((f,i)=><button key={f?.id||'root'} onClick={()=>setFolder(f?.id||null)} className="rounded-md px-2 py-1 hover:bg-indigo-500/10">{i?'› ':''}{f?.name||'Корень'}</button>)}</div>
     <div className="mt-3 flex flex-wrap gap-2">
      <input className="min-w-32 flex-1 rounded-xl border border-current/15 bg-transparent px-3 py-2 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию, исполнителю, альбому, жанру"/>
      <select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-current/15 bg-transparent px-2 text-sm"><option value="name">Название</option><option value="artist">Исполнитель</option><option value="duration">Длительность</option><option value="recent">Недавние</option></select>
      <button type="button" onClick={()=>setView(view==='list'?'tiles':'list')} className="rounded-xl border border-current/15 px-3 py-2 text-sm">{view==='list'?'Значки':'Список'}</button>
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-current/10 p-2">
       <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(list.length)&&selectedIds.length===list.length} onChange={e=>setChecked(e.target.checked?list.map(a=>a.id):[])}/> Выбрать страницу</label>
       <span className="text-xs opacity-65">Выбрано: {selectedIds.length}</span>
       <button type="button" disabled={!selectedIds.length} onClick={()=>setShowPlaylist(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">＋ Плейлист из выбранных</button>
       <button type="button" disabled={!selectedIds.length} onClick={()=>{setMoveItem({id:null,name:selectedIds.length+' записей'});setMoveTarget(folder||'');}} className="rounded-lg border border-current/15 px-3 py-2 text-xs disabled:opacity-40">Переместить</button>
       <span className="ml-auto text-xs opacity-60">{results.total} записей в папке</span>
     </div>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}
    {childFolders.length>0&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{childFolders.map(f=><div key={f.id} className="flex items-center gap-1 rounded-xl border border-current/10 radio-surface-soft0 p-2 dark:bg-slate-900/30">
     <button className="min-w-0 flex-1 truncate p-2 text-left text-sm" onDragOver={e=>e.preventDefault()} onDrop={e=>dropTo(f.id,e)} onClick={()=>setFolder(f.id)}>📁 {f.name}</button>
     <button title="Переименовать" onClick={()=>{const n=window.prompt('Название папки',f.name);if(n?.trim())void operation(()=>request('/asset-folders/'+f.id,{method:'PATCH',body:{name:n.trim()}}));}}>✎</button>
     <button title="Удалить пустую папку" onClick={()=>{if(window.confirm('Удалить пустую папку?'))void operation(()=>request('/asset-folders/'+f.id,{method:'DELETE'}));}}>×</button>
    </div>)}</div>}
    <div className={view==='tiles'?'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4':'overflow-x-auto rounded-xl border border-current/10 bg-white/40 dark:bg-slate-900/30'}>
     {list.map(a=><article key={a.id} draggable onDragStart={e=>startDrag(a,e)} onContextMenu={e=>{e.preventDefault();setMenu({id:a.id,x:Math.min(e.clientX,window.innerWidth-205),y:Math.min(e.clientY,window.innerHeight-290)});}} className={view==='tiles'?'min-w-0 rounded-xl border border-current/10 bg-white/60 p-3 dark:bg-slate-900/50':'flex min-w-[550px] items-center gap-3 border-b border-current/10 p-3 last:border-none'}>
      <input aria-label={'Выбрать '+name(a)} type="checkbox" checked={checked.includes(a.id)} onChange={()=>toggle(a.id)} />
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-600 dark:text-indigo-300">♫</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={name(a)}>{name(a)}</p>
       <p className="mt-1 truncate text-xs opacity-60">{[a.tags?.album,a.tags?.genre].filter(Boolean).join(' · ')||a.name}</p>
       <p className="mt-1 text-xs tabular-nums opacity-55">{fmt(a.durationMs)} · {size(a.byteSize)}</p></div>
      <div className="flex gap-1">
       <button onClick={()=>preview(a)} title="Прослушать" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">▶</button>
       <button onClick={()=>setMenu({id:a.id,x:Math.max(8,window.innerWidth-230),y:Math.min(window.innerHeight-300,220)})} title="Действия" aria-label={'Меню '+name(a)} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs">⋯</button>
      </div>
     </article>)}
     {!list.length&&<p className="p-8 text-center text-sm opacity-60">В этой папке нет подходящих записей</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
      <span>Страница {page} из {results.pages||1} · Всего {results.total}</span>
      <div className="flex items-center gap-2">
       <select aria-label="Записей на странице" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} className="rounded-lg border border-current/15 bg-transparent p-2"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
       <button type="button" disabled={page<=1||loading} onClick={()=>setPage(v=>v-1)} className="rounded-lg border border-current/15 px-3 py-2 disabled:opacity-30">←</button>
       <button type="button" disabled={page>=results.pages||loading} onClick={()=>setPage(v=>v+1)} className="rounded-lg border border-current/15 px-3 py-2 disabled:opacity-30">→</button>
      </div>
    </div>
    {player}
   </div>
  </div>
  {menu&&<><button type="button" aria-label="Закрыть контекстное меню" className="fixed inset-0 z-40" onClick={()=>setMenu(null)}/><div className="fixed z-50 w-48 space-y-1 rounded-xl border border-current/10 bg-white p-2 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white" style={{left:menu.x,top:menu.y}}>
   {(()=>{const a=list.find(x=>x.id===menu.id);if(!a)return null;return <>
    {[[ 'Прослушать',()=>preview(a) ],['Изменить теги',()=>openTags(a)],['Считать ID3',()=>rescan(a)],['Переместить',()=>moveAsset(a)],['Переименовать',()=>rename(a)],['Удалить',()=>remove(a)]].map(([label,fn])=><button key={label} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-500/10" onClick={()=>{setMenu(null);fn();}}>{label}</button>)}
   </>;})()}
   </div></>}
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
      {folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
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
