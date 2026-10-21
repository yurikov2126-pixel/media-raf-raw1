import {useMemo,useRef,useState} from 'react';
import RadioPlaylistTransitions,{pairTransitions} from './RadioPlaylistTransitions.jsx';

const duration=ms=>{const sec=Math.max(0,Math.round(ms/1000));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');};
const input='w-full rounded-xl border border-current/20 bg-white/90 px-3 py-2 text-slate-900 dark:bg-slate-900 dark:text-slate-100';
export default function RadioPlaylistWorkbench({
 assets=[],selected,onSelected,transitions,onTransitions,name,onName,description,onDescription,
 editing,onSave,onCancel,onPreview,busy=false
}){
 const [query,setQuery]=useState(''),[onlyAvailable,setOnlyAvailable]=useState(false);
 const [selectedRow,setSelectedRow]=useState(null),[transitionOpen,setTransitionOpen]=useState(false);
 const drag=useRef(null),[dragOver,setDragOver]=useState(null);
 const byId=useMemo(()=>new Map(assets.map(a=>[a.id,a])),[assets]);
 const chosen=new Set(selected);
 const library=useMemo(()=>assets.filter(a=>(!onlyAvailable||!chosen.has(a.id))&&
  [a.name,a.tags?.artist].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU'))),[assets,query,onlyAvailable,selected]);
 const pairList=pairTransitions(selected,transitions);
 const total=selected.reduce((sum,id)=>sum+(byId.get(id)?.durationMs||0),0)-
  pairList.reduce((sum,x)=>sum+(x.mode==='crossfade'?x.overlapMs:0),0);
 const move=(from,to)=>{
  if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||to<0||from>=selected.length||to>=selected.length)return;
  const next=[...selected];next.splice(to,0,...next.splice(from,1));onSelected(next);
 };
 const begin=(event,index)=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();drag.current={pointerId:event.pointerId,from:index,to:index};
  event.currentTarget.setPointerCapture(event.pointerId);setDragOver(index);
 };
 const track=event=>{
  const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
  const row=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-radio-track-index]');
  if(row){const to=Number(row.dataset.radioTrackIndex);if(Number.isInteger(to)){active.to=to;setDragOver(to);}}
 };
 const end=event=>{const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
  drag.current=null;setDragOver(null);if(event.type!=='pointercancel')move(active.from,active.to);
 };
 const add=id=>{if(!chosen.has(id))onSelected([...selected,id]);};
 const remove=index=>onSelected(selected.filter((_,i)=>i!==index));
 return <section className="radio-playlist-workbench space-y-4 rounded-2xl border border-current/15 p-3 sm:p-5">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[11px] font-bold uppercase tracking-widest opacity-55">RADIO 3.0 · МУЗЫКАЛЬНЫЙ РЕДАКТОР</p>
    <h3 className="text-xl font-bold">{editing?'Редактирование плейлиста':'Новый плейлист'}</h3>
    <p className="mt-1 text-xs opacity-65">Список и аудиотека доступны одновременно, без пошагового мастера.</p>
   </div>
   <div className="rounded-xl border border-current/15 px-3 py-2 text-sm tabular-nums">
    {selected.length} записей · {duration(total)}
   </div>
  </header>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="text-xs font-semibold">Название<input value={name} onChange={e=>onName(e.target.value)} maxLength={140} required className={'mt-1 '+input} placeholder="Название передачи"/></label>
   <label className="text-xs font-semibold">Описание<input value={description} onChange={e=>onDescription(e.target.value)} maxLength={2000} className={'mt-1 '+input} placeholder="Описание программы"/></label>
  </div>
  <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(290px,.8fr)]">
   <section aria-label="Состав плейлиста" className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Порядок эфира</h4>
     <button type="button" onClick={()=>onSelected([])} disabled={!selected.length} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs">Очистить список</button>
    </div>
    {!selected.length&&<div className="rounded-xl border border-dashed border-current/20 p-8 text-center text-sm opacity-65">Выберите записи из аудиотеки справа (на телефоне — ниже).</div>}
    {selected.map((id,index)=>{
     const asset=byId.get(id);return <div key={id+'-'+index} data-radio-track-index={index}
      className={'flex items-center gap-2 rounded-xl border p-2 transition-colors '+(dragOver===index?'border-violet-500 bg-violet-500/10':'border-current/10')}>
      <button type="button" aria-label={'Перетащить '+(asset?.name||id)} title="Удерживайте и перетащите"
       className="w-9 shrink-0 cursor-grab touch-none select-none rounded-lg border border-current/10 py-2 text-center"
       style={{touchAction:'none'}} onPointerDown={e=>begin(e,index)} onPointerMove={track} onPointerUp={end} onPointerCancel={end}>⠿</button>
      <span className="w-6 shrink-0 text-xs tabular-nums opacity-50">{index+1}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset?.name||id}</p>
       <p className="text-xs opacity-55">{asset?.tags?.artist||'Аудиозапись'} · {duration(asset?.durationMs||0)}</p></div>
      <button type="button" title="Прослушать" aria-label={'Прослушать '+(asset?.name||id)}
       onClick={()=>asset&&onPreview(asset)} className="rounded-lg border border-current/15 px-2.5 py-2 text-xs">▶</button>
      <button type="button" title="Настройка переходов" aria-label="Настройка переходов"
       onClick={()=>{setSelectedRow(selectedRow===index?null:index);setTransitionOpen(true);}}
       className="rounded-lg border border-current/15 px-2.5 py-2 text-xs">≋</button>
      <button type="button" aria-label={'Удалить '+(asset?.name||id)} onClick={()=>remove(index)}
       className="rounded-lg border border-red-500/20 px-2.5 py-2 text-xs text-red-600 dark:text-red-300">×</button>
     </div>;
    })}
    <button type="button" onClick={()=>setTransitionOpen(v=>!v)}
     className="w-full rounded-xl border border-current/20 px-3 py-3 text-left text-sm font-semibold">
     {transitionOpen?'▾ Скрыть настройки переходов':'▸ Настройки кроссфейдов между композициями'}
    </button>
    {transitionOpen&&<RadioPlaylistTransitions ids={selected} assets={assets} settings={transitions} onChange={onTransitions}/>}
    {selectedRow!==null&&<p className="text-xs opacity-65">Выбрана композиция №{selectedRow+1}. Параметры перехода задаются для соседних композиций в блоке выше.</p>}
   </section>
   <aside className="min-w-0 space-y-3 rounded-2xl border border-current/15 p-3 xl:sticky xl:top-20">
    <div><h4 className="font-semibold">Аудиотека</h4><p className="text-xs opacity-60">Добавляйте музыку прямо в конец плейлиста.</p></div>
    <input className={input} placeholder="Найти песню или исполнителя" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Поиск записей аудиотеки"/>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={onlyAvailable} onChange={e=>setOnlyAvailable(e.target.checked)}/>Только не добавленные</label>
    <div className="max-h-[490px] space-y-1 overflow-y-auto pr-1">
     {library.map(asset=><div key={asset.id} className="flex items-center gap-2 rounded-xl border border-current/10 p-2">
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{asset.name}</p>
       <p className="truncate text-[11px] opacity-60">{asset.tags?.artist||'Аудиозапись'} · {duration(asset.durationMs||0)}</p></div>
      <button type="button" aria-label={'Прослушать '+asset.name} onClick={()=>onPreview(asset)} className="rounded-lg border border-current/15 px-2 py-1.5">▶</button>
      <button type="button" aria-label={'Добавить '+asset.name} onClick={()=>add(asset.id)} disabled={chosen.has(asset.id)}
       className="rounded-lg bg-violet-700 px-2.5 py-1.5 text-sm font-semibold text-white disabled:opacity-35">＋</button>
     </div>)}
     {!library.length&&<p className="p-4 text-center text-xs opacity-65">Записи не найдены.</p>}
    </div>
    <p className="text-xs opacity-60">{library.length} аудиозаписей в выборке</p>
   </aside>
  </div>
  <footer className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-between gap-3 border-t border-current/10 bg-white/90 px-3 py-3 backdrop-blur-xl dark:bg-slate-900/95 sm:-mx-5 sm:px-5">
   <p className="text-xs opacity-70">Плейлист не изменится в эфире до сохранения.</p>
   <div className="flex gap-2">
    <button type="button" onClick={onCancel} className="rounded-xl border border-current/20 px-4 py-2 text-sm">Отмена</button>
    <button type="button" disabled={busy||!selected.length||!name.trim()} onClick={onSave}
     className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Сохранить плейлист</button>
   </div>
  </footer>
 </section>;
}
