import {useEffect,useMemo,useState} from 'react';
import {api} from '../api/client.js';
const fmt=ms=>{const s=Math.floor((ms||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const size=b=>b>1048576?(b/1048576).toFixed(1)+' МБ':(b/1024).toFixed(0)+' КБ';
const name=a=>a.tags?.title?[a.tags.artist,a.tags.title].filter(Boolean).join(' — '):a.name;
const keys=['title','artist','album','genre','year','track','composer','comment'];
const labels={title:'Название',artist:'Исполнитель',album:'Альбом',genre:'Жанр',year:'Год',track:'Номер трека',composer:'Композитор',comment:'Комментарий'};
export default function RadioAssetManager({assets,token,refresh,preview,rename,remove,uploadPanel,player}){
 const [folders,setFolders]=useState([]),[folder,setFolder]=useState(null),[query,setQuery]=useState(''),[sort,setSort]=useState('name');
 const [view,setView]=useState('list'),[selected,setSelected]=useState(null),[tags,setTags]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=(url,options)=>api('/radio'+url,{token,...options});
 const reload=async()=>{try{setFolders((await request('/asset-folders')).folders||[]);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{void reload();},[token]);
 const current=folders.find(f=>f.id===folder);
 const ancestors=[];let pointer=current;
 while(pointer&&ancestors.length<12){if(ancestors.includes(pointer))break;ancestors.unshift(pointer);pointer=folders.find(f=>f.id===pointer.parentId);}
 const childFolders=folders.filter(f=>(f.parentId||null)===folder);
 const list=useMemo(()=>{
  const q=query.toLocaleLowerCase('ru').trim();
  return assets.filter(a=>(a.folderId||null)===folder).filter(a=>!q||[a.name,...Object.values(a.tags||{})].join(' ').toLocaleLowerCase('ru').includes(q))
  .sort((a,b)=>sort==='duration'?(b.durationMs||0)-(a.durationMs||0):sort==='recent'?new Date(b.createdAt)-new Date(a.createdAt):sort==='artist'?String(a.tags?.artist||'').localeCompare(String(b.tags?.artist||''),'ru'):name(a).localeCompare(name(b),'ru'));
 },[assets,folder,query,sort]);
 const operation=async(fn)=>{setBusy(true);setError('');try{await fn();await refresh();await reload();}catch(e){setError(e.message||'Не удалось выполнить действие');}finally{setBusy(false);}};
 const addFolder=()=>{const title=window.prompt('Название папки');if(title?.trim())void operation(()=>request('/asset-folders',{method:'POST',body:{name:title.trim(),parentId:folder}}));};
 const moveAsset=a=>{const target=window.prompt('Переместить в папку: введите ID папки из списка или оставьте пустым для корня','');if(target===null)return;void operation(()=>request('/assets/'+a.id+'/organize',{method:'PATCH',body:{folderId:target.trim()||null}}));};
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
   <aside className="rounded-2xl border border-current/10 bg-white/50 p-3 dark:bg-slate-900/40">
    <p className="px-2 py-2 text-xs uppercase tracking-widest opacity-55">Папки</p>
    <button className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${!folder?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} onClick={()=>setFolder(null)}>▣ Вся библиотека / корень</button>
    {folders.map(f=><button key={f.id} onClick={()=>setFolder(f.id)} className={`mt-1 block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${folder===f.id?'bg-indigo-600 text-white':'hover:bg-black/5 dark:hover:bg-white/10'}`} title={f.name}>▸ {f.name}</button>)}
    <p className="mt-5 px-2 text-xs opacity-55">ID папки для перемещения: нажмите на папку</p>
    {folder&&<button type="button" className="mx-2 mt-2 rounded-lg border border-current/15 px-2 py-1 text-xs" onClick={()=>navigator.clipboard?.writeText(folder)}>Копировать ID папки</button>}
   </aside>
   <div className="min-w-0 space-y-3">
    <div className="rounded-xl border border-current/10 bg-white/50 p-3 dark:bg-slate-900/40">
     <div className="flex flex-wrap items-center gap-2 text-xs">{[null,...ancestors].map((f,i)=><button key={f?.id||'root'} onClick={()=>setFolder(f?.id||null)} className="rounded-md px-2 py-1 hover:bg-indigo-500/10">{i?'› ':''}{f?.name||'Корень'}</button>)}</div>
     <div className="mt-3 flex flex-wrap gap-2">
      <input className="min-w-32 flex-1 rounded-xl border border-current/15 bg-transparent px-3 py-2 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию, исполнителю, альбому, жанру"/>
      <select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-current/15 bg-transparent px-2 text-sm"><option value="name">Название</option><option value="artist">Исполнитель</option><option value="duration">Длительность</option><option value="recent">Недавние</option></select>
      <button type="button" onClick={()=>setView(view==='list'?'tiles':'list')} className="rounded-xl border border-current/15 px-3 py-2 text-sm">{view==='list'?'Значки':'Список'}</button>
     </div>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}
    {childFolders.length>0&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{childFolders.map(f=><div key={f.id} className="flex items-center gap-1 rounded-xl border border-current/10 bg-white/50 p-2 dark:bg-slate-900/30">
     <button className="min-w-0 flex-1 truncate p-2 text-left text-sm" onClick={()=>setFolder(f.id)}>📁 {f.name}</button>
     <button title="Переименовать" onClick={()=>{const n=window.prompt('Название папки',f.name);if(n?.trim())void operation(()=>request('/asset-folders/'+f.id,{method:'PATCH',body:{name:n.trim()}}));}}>✎</button>
     <button title="Удалить пустую папку" onClick={()=>{if(window.confirm('Удалить пустую папку?'))void operation(()=>request('/asset-folders/'+f.id,{method:'DELETE'}));}}>×</button>
    </div>)}</div>}
    <div className={view==='tiles'?'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4':'overflow-x-auto rounded-xl border border-current/10 bg-white/40 dark:bg-slate-900/30'}>
     {list.map(a=><article key={a.id} className={view==='tiles'?'min-w-0 rounded-xl border border-current/10 bg-white/60 p-3 dark:bg-slate-900/50':'flex min-w-[550px] items-center gap-3 border-b border-current/10 p-3 last:border-none'}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-600 dark:text-indigo-300">♫</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={name(a)}>{name(a)}</p>
       <p className="mt-1 truncate text-xs opacity-60">{[a.tags?.album,a.tags?.genre].filter(Boolean).join(' · ')||a.name}</p>
       <p className="mt-1 text-xs tabular-nums opacity-55">{fmt(a.durationMs)} · {size(a.byteSize)}</p></div>
      <div className={view==='tiles'?'mt-2 flex flex-wrap gap-1':'flex flex-wrap gap-1'}>
       <button onClick={()=>preview(a)} title="Слушать" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">▶</button>
       <button onClick={()=>openTags(a)} title="Редактировать ID3-теги" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">Теги</button>
       <button onClick={()=>moveAsset(a)} title="Переместить в папку" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">↳</button>
       <button onClick={()=>rename(a)} title="Переименовать" className="rounded-lg border border-current/15 px-2 py-1.5 text-xs">✎</button>
       <button onClick={()=>remove(a)} title="Удалить" className="rounded-lg border border-rose-500/30 px-2 py-1.5 text-xs text-rose-500">×</button>
      </div>
     </article>)}
     {!list.length&&<p className="p-8 text-center text-sm opacity-60">В этой папке нет подходящих записей</p>}
    </div>
    {player}
   </div>
  </div>
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
