import {useEffect,useRef,useState} from 'react';
import {api} from '../api/client.js';
import {mergePinnedAutoPlaylist} from './radioAutoPlaylistPinned.js';
const duration=ms=>Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0');
export default function RadioAutoPlaylistDraftEditor({token,config,assets,onSaved,onPublished}){
 const [items,setItems]=useState(()=>Array.isArray(config.draftItems)?config.draftItems:[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [libraryQuery,setLibraryQuery]=useState('');
 const [editingIndex,setEditingIndex]=useState(null);
 const [dragIndex,setDragIndex]=useState(null);
 const gesture=useRef(null);
 useEffect(()=>{setItems(Array.isArray(config.draftItems)?config.draftItems:[]);setError('');setNotice('');},[config.id,config.draftItems]);
 const call=(path,options)=>api('/radio'+path,{token,...options});
 const change=(fn)=>{setItems(previous=>fn(previous));setNotice('Есть несохранённые изменения');};
 const move=(index,to)=>change(a=>{if(to<0||to>=a.length||index===to)return a;const copy=[...a];copy.splice(to,0,...copy.splice(index,1));return copy;});
 const beginPointer=(event,index)=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  gesture.current={pointerId:event.pointerId,from:index,to:index,startY:event.clientY,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  setDragIndex(index);
 };
 const trackPointer=event=>{
  const active=gesture.current;
  if(!active||event.pointerId!==active.pointerId)return;
  if(Math.abs(event.clientY-active.startY)>5)active.moved=true;
  const el=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-auto-draft-index]');
  if(el){const next=Number(el.dataset.autoDraftIndex);if(Number.isInteger(next)){active.to=next;setDragIndex(next);}}
 };
 const endPointer=event=>{
  const active=gesture.current;
  if(!active||event.pointerId!==active.pointerId)return;
  gesture.current=null;setDragIndex(null);
  if(active.to!==active.from)move(active.from,active.to);
 };
 const generate=async()=>{
  setBusy(true);setError('');
  try{
   const data=await call('/auto-playlists/'+config.id+'/preview');
   setItems(previous=>mergePinnedAutoPlaylist(previous,data.preview.items.map(x=>({...x,pinned:false,fadeMs:Math.round(x.fadeMs||0)}))));
   setNotice('Подборка обновлена, закреплённые позиции сохранены. Сохраните черновик вручную.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const save=async()=>{
  setBusy(true);setError('');
  try{
   await call('/auto-playlists/'+config.id+'/draft',{method:'PUT',body:{items}});
   setNotice('Черновик сохранён. В эфир не опубликован.');
   await onSaved?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const publish=async()=>{
  if(!items.length||!window.confirm('Создать отдельный утверждённый плейлист из сохранённого черновика? Текущие несохранённые изменения не войдут в публикацию.'))return;
  setBusy(true);setError('');
  try{
   const result=await call('/auto-playlists/'+config.id+'/publish',{method:'POST'});
   setNotice('Создан утверждённый плейлист «'+result.playlist.name+'». Он доступен в общем списке.');
   await onPublished?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const raw=items.reduce((sum,x,i)=>sum+(x.durationMs||assets.find(a=>a.id===x.assetId)?.durationMs||0)-
  (i&&x.kind==='MUSIC'&&items[i-1].kind==='MUSIC'?x.fadeMs||0:0),0);
 return <div className="space-y-3 rounded-2xl border border-current/15 p-3 sm:p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><div>
   <h3 className="font-semibold">Редактор: {config.name}</h3>
   <p className="text-xs opacity-65">{items.length} записей · около {duration(Math.max(0,raw))} · черновик не в эфире</p></div>
   <button type="button" onClick={generate} disabled={busy} className="rounded-xl border border-current/20 px-3 py-2 text-sm">Обновить, сохранив закреплённые</button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  {notice&&<p role="status" className="text-sm opacity-75">{notice}</p>}
  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-current/15 p-3">
    <div><p className="text-sm font-semibold">Полный список композиций</p>
      <p className="text-xs opacity-65">Все {items.length} записей показаны в исходном порядке. Перетаскивайте за ручку слева.</p></div>
    <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm" onClick={()=>setEditingIndex(null)}>Закрыть редактирование</button>
  </div>
  <div className="space-y-2">
   {items.map((item,index)=><div key={index} data-auto-draft-index={index} className={"flex flex-wrap items-center gap-2 rounded-xl border p-2 text-sm "+(dragIndex===index?"border-violet-500 bg-violet-500/10":"border-current/10")}>
    <button type="button" disabled={busy} aria-label={`Перетащить композицию ${index+1}`} title="Удерживайте и перетащите" onPointerDown={e=>beginPointer(e,index)} onPointerMove={trackPointer} onPointerUp={endPointer} onPointerCancel={endPointer}
      style={{touchAction:'none'}} className="w-10 shrink-0 cursor-grab touch-none select-none rounded-lg border border-current/15 px-2 py-2 active:cursor-grabbing">⠿</button>
    <span className="w-6 shrink-0 opacity-50">{index+1}.</span>
    <div className="min-w-40 flex-1"><p className="truncate font-medium">{assets.find(a=>a.id===item.assetId)?.name||item.assetId}</p>
     <p className="text-xs opacity-55">{item.kind==='JINGLE'?'Джингл':'Музыка'} · {duration(item.durationMs||0)}</p></div>
    <button type="button" onClick={()=>setEditingIndex(editingIndex===index?null:index)} className="rounded-lg border border-current/15 px-2 py-1">Изменить</button>
    <button type="button" onClick={()=>change(a=>a.map((x,i)=>i===index?{...x,pinned:!x.pinned}:x))}
     aria-label={item.pinned?'Открепить':'Закрепить'} className={'rounded-lg border px-2 py-1 '+(item.pinned?'border-violet-500 text-violet-700 dark:text-violet-300':'border-current/15')}>{item.pinned?'Закреплено':'Закрепить'}</button>
    <button type="button" onClick={()=>change(a=>a.filter((_,i)=>i!==index))} className="rounded-lg border border-red-500/30 px-2 py-1 text-red-700 dark:text-red-300">Убрать</button>
   {editingIndex===index&&<div className="basis-full grid gap-2 rounded-xl border border-current/10 bg-current/5 p-3 sm:grid-cols-2">
      <label className="text-xs">Заменить аудиофайл
        <select className="mt-1 w-full rounded-lg border border-current/20 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" value={item.assetId}
          onChange={e=>{const asset=assets.find(a=>a.id===e.target.value);if(asset)change(old=>old.map((x,i)=>i===index?{...x,assetId:asset.id,durationMs:asset.durationMs}:x));}}>
          {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="text-xs">Тип
        <select className="mt-1 w-full rounded-lg border border-current/20 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" value={item.kind}
          onChange={e=>change(old=>old.map((x,i)=>i===index?{...x,kind:e.target.value,fadeMs:e.target.value==='JINGLE'?0:x.fadeMs}:x))}>
          <option value="MUSIC">Музыка</option><option value="JINGLE">Джингл</option>
        </select>
      </label>
      <label className="text-xs">Плавный переход (мс)
        <input type="number" min="0" max="8000" step="100" value={item.fadeMs||0} onChange={e=>change(old=>old.map((x,i)=>i===index?{...x,fadeMs:Number(e.target.value)}:x))}
          className="mt-1 w-full rounded-lg border border-current/20 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white"/>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" onClick={()=>change(old=>{const next=[...old];next.splice(index,0,{...item,pinned:false});return next;})}
          className="rounded-lg border border-current/20 px-3 py-2 text-xs">Дублировать перед</button>
        <button type="button" onClick={()=>setEditingIndex(null)} className="rounded-lg border border-current/20 px-3 py-2 text-xs">Готово</button>
      </div>
    </div>}
   </div>)}
  </div>
  <div className="space-y-2 rounded-xl border border-current/15 p-3">
    <h4 className="font-semibold text-sm">Добавить композицию из аудиотеки</h4>
    <input className="w-full rounded-xl border border-current/20 bg-white px-3 py-2 text-slate-900 dark:bg-slate-900 dark:text-white"
      placeholder="Найти песню по названию" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)}/>
    <div className="max-h-64 space-y-1 overflow-auto">
      {assets.filter(a=>a.name.toLocaleLowerCase('ru-RU').includes(libraryQuery.toLocaleLowerCase('ru-RU'))).map(a=><div key={a.id}
        className="flex items-center gap-2 rounded-lg border border-current/10 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{a.name}</span><span className="text-xs opacity-60">{duration(a.durationMs||0)}</span>
        <button type="button" onClick={()=>change(old=>[...old,{assetId:a.id,kind:'MUSIC',pinned:false,fadeMs:config.fadeMs||0,durationMs:a.durationMs}])}
          className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs text-white">Добавить</button>
      </div>)}
    </div>
  </div>
  <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Сохранить черновик</button>
  <button type="button" disabled={busy||!Array.isArray(config.draftItems)||!config.draftItems.length} onClick={publish} className="rounded-xl border border-emerald-600/50 px-4 py-2 font-semibold text-emerald-700 dark:text-emerald-300 disabled:opacity-50">Создать эфирную версию</button></div>
  <p className="text-xs opacity-65">Публикуется только последняя сохранённая версия. Публикация не запускает эфир и не добавляет событие в расписание.</p>
 </div>;
}
