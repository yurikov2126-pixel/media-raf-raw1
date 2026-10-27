import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useSearchParams} from 'react-router-dom';
import {api} from '../api/client.js';
import {useAuth} from '../store/auth.jsx';
import {useToast} from '../store/toast.jsx';
const textField='w-full rounded-xl border border-current/20 bg-transparent p-3 text-sm';
const titles={DRAFT:'Черновик',ASSIGNED:'Назначено',REVIEW:'На проверке',RETURNED:'На доработке',APPROVED:'Сценарий утверждён'};
export default function RadioHostAssignments(){
 const {token}=useAuth(),toast=useToast();
 const [searchParams]=useSearchParams();
 const episodeFromLink=searchParams.get('episode');
 const [loadError,setLoadError]=useState('');
 const [reading,setReading]=useState(false),[fontSize,setFontSize]=useState(26),[readerTheme,setReaderTheme]=useState('dark');
 const readerRef=useRef(null);
 const [assets,setAssets]=useState([]),[mediaIds,setMediaIds]=useState([]),[mediaOpen,setMediaOpen]=useState(false);
 const [episodes,setEpisodes]=useState([]),[selected,setSelected]=useState(null),[script,setScript]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const call=useCallback((route,options)=>api('/radio/student'+route,{token,...options}),[token]);
 const refresh=useCallback(async()=>{try{const result=await call('/episodes');setEpisodes(result.episodes||[]);setLoadError('');return result.episodes||[];}catch(e){setLoadError(e.message||'Не удалось получить радиозадания');throw e;}},[call]);
 useEffect(()=>{let alive=true;refresh().catch(e=>{if(alive)toast.error(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[refresh]);
 useEffect(()=>{if(!episodeFromLink)return;const item=episodes.find(e=>e.id===episodeFromLink);if(item){setSelected(item);setScript(item.script||'');setMediaIds(item.mediaAssetIds||[])}},[episodeFromLink,episodes]);
 useEffect(()=>{const onFocus=()=>{void refresh().catch(()=>{});};window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[refresh]);
 useEffect(()=>{if(!reading)return;const prior=document.activeElement,old=document.body.style.overflow;document.body.style.overflow='hidden';readerRef.current?.focus();const onKey=e=>{if(e.key==='Escape'){e.preventDefault();setReading(false)}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=old;prior?.focus?.()}},[reading]);
 const open=e=>{setSelected(e);setScript(e.script||'');setMediaIds(e.mediaAssetIds||[]);setMediaOpen(false)};
 const saveMedia=async()=>{if(!selected)return;setBusy(true);try{const result=await call('/episodes/'+selected.id+'/media',{method:'PATCH',body:{assetIds:mediaIds}});setSelected(result.episode);await refresh();toast.success('Материалы задания сохранены');}catch(e){toast.error(e.message)}finally{setBusy(false)}};
 const submit=async send=>{if(!selected)return;setBusy(true);try{
  let episode=selected;
  if(script!==episode.script){
   const result=await call('/episodes/'+episode.id+'/script',{method:'PATCH',body:{script,revision:episode.scriptRevision}});
   episode=result.episode;
  }
  if(send){const result=await call('/episodes/'+episode.id+'/submit',{method:'POST'});episode=result.episode;}
  const fresh=await refresh();const updated=fresh.find(e=>e.id===episode.id)||episode;
  setSelected(updated);setScript(updated.script||'');
  toast.success(send?'Сценарий отправлен на проверку':'Сценарий сохранён');
 }catch(e){toast.error(e.message||'Не удалось сохранить')}finally{setBusy(false)}};
 return <section className="space-y-3 rounded-2xl border border-current/15 p-4">
  <header><h2 className="text-lg font-bold">Мои радиозадания</h2><p className="text-xs opacity-70">Сценарии назначенных выпусков Политех-FM. Изменения сохраняются по кнопке.</p></header>
  {loading&&<p className="text-sm opacity-60">Загружаем задания…</p>}
  {loadError&&<div role="alert" className="rounded-xl border border-red-500/30 p-3 text-sm text-red-600">Ошибка получения заданий: {loadError} <button type="button" className="underline" onClick={()=>refresh().catch(()=>{})}>Повторить</button></div>}
  <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={()=>refresh().catch(()=>{})}>Обновить задания</button>
  <div className="grid gap-2 sm:grid-cols-2">{episodes.map(e=><button key={e.id} onClick={()=>open(e)}
   className="rounded-xl border border-current/15 p-3 text-left hover:bg-violet-500/10">
   <span className="block font-semibold text-sm">{e.title}</span>
   <span className="block text-xs opacity-70">{new Date(e.startAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'})} · {titles[e.status]||e.status}</span>
  </button>)}</div>
  {!loading&&!loadError&&!episodes.length&&<p className="text-sm opacity-60">Пока нет назначенных передач.</p>}
  {selected&&<div className="space-y-3 rounded-xl border border-violet-500/25 p-3">
   <div className="flex justify-between gap-2"><div><h3 className="font-semibold">{selected.title}</h3><p className="text-xs opacity-60">{titles[selected.status]||selected.status}</p></div>
    <button onClick={()=>setSelected(null)} aria-label="Закрыть карточку">✕</button></div>
   <button type="button" disabled={!script.trim()} onClick={()=>setReading(true)} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Открыть режим чтения</button>
   <div className="rounded-xl border border-current/15 p-3 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Аудиоматериалы задания ({mediaIds.length})</strong>
     <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={async()=>{if(!mediaOpen){try{const result=await call('/assets');setAssets(result.assets||[])}catch(e){toast.error(e.message)}}setMediaOpen(v=>!v)}}>{mediaOpen?'Скрыть медиатеку':'Выбрать из медиатеки'}</button>
    </div>
    {mediaOpen&&<div className="max-h-52 overflow-y-auto space-y-1">{assets.map(a=><label key={a.id} className="flex items-center gap-2 rounded-md p-1 text-xs">
     <input type="checkbox" disabled={!['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)} checked={mediaIds.includes(a.id)}
      onChange={e=>setMediaIds(v=>e.target.checked?[...v,a.id]:v.filter(id=>id!==a.id))}/><span className="truncate">{a.name}</span></label>)}</div>}
    {mediaOpen&&['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)&&<button type="button" disabled={busy||mediaIds.length>30} className="rounded-lg bg-violet-700 px-3 py-2 text-xs text-white" onClick={saveMedia}>Сохранить вложения</button>}
   </div>
   {selected.reviewReason&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Замечания редактора: {selected.reviewReason}</p>}
   <label className="block text-sm">Сценарий выпуска<textarea rows={12} value={script} disabled={!['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)||busy}
    onChange={e=>setScript(e.target.value)} className={'mt-2 '+textField}/></label>
   {['ASSIGNED','DRAFT','RETURNED'].includes(selected.status)&&<div className="flex flex-wrap gap-2">
    <button disabled={busy} onClick={()=>submit(false)} className="rounded-lg border border-current/20 px-4 py-2 text-sm">Сохранить текст</button>
    <button disabled={busy||!script.trim()} onClick={()=>submit(true)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white">Отправить на проверку</button>
   </div>}
  </div>}
  {reading&&selected&&createPortal(<div ref={readerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Режим чтения сценария" className={'fixed inset-0 z-[200] flex flex-col '+(readerTheme==='dark'?'bg-[#101018] text-[#f7f5ef]':'bg-[#f6f1e6] text-[#201d19]')}>
   <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-current/20 bg-inherit px-4 py-3 sm:px-8">
    <div className="min-w-0 flex-1"><p className="text-xs opacity-65">Политех-FM · Суфлёр ведущего</p><h2 className="line-clamp-2 text-sm font-semibold sm:text-base">{selected.title}</h2></div>
    <div className="flex shrink-0 items-center gap-2">
     <button type="button" onClick={()=>setFontSize(n=>Math.max(18,n-2))} aria-label="Уменьшить шрифт" className="rounded-lg border border-current/30 px-3 py-2">A−</button>
     <button type="button" onClick={()=>setFontSize(n=>Math.min(44,n+2))} aria-label="Увеличить шрифт" className="rounded-lg border border-current/30 px-3 py-2">A+</button>
     <button type="button" onClick={()=>setReaderTheme(t=>t==='dark'?'light':'dark')} className="rounded-lg border border-current/30 px-3 py-2 text-sm">{readerTheme==='dark'?'Светлая':'Тёмная'}</button>
     <button type="button" onClick={()=>setReading(false)} aria-label="Закрыть режим чтения" className="rounded-lg border border-current/30 px-3 py-2">✕</button>
    </div>
   </header>
   <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12" aria-label="Текст для чтения">
    <article className="mx-auto max-w-4xl whitespace-pre-wrap break-words font-medium leading-[1.8]" style={{fontSize:fontSize+'px'}}>{script}</article>
   </main>
   <footer className="shrink-0 border-t border-current/15 bg-inherit px-4 py-2 text-center text-xs opacity-65">{fontSize} px · Прокручивайте текст вверх · Esc — закрыть</footer>
  </div>,document.body)}
 </section>;
}
