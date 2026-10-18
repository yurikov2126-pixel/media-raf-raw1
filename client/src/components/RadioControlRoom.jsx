import {useCallback,useEffect,useState} from 'react';
import {api} from '../api/client.js';
const z='Europe/Moscow';
const displayTime=value=>value?new Date(value).toLocaleTimeString('ru-RU',{timeZone:z,hour:'2-digit',minute:'2-digit'}):'—';
const duration=ms=>{const s=Math.max(0,Math.floor((ms||0)/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const modes={SCHEDULED:'По расписанию',AUTO_DJ:'Auto-DJ',SILENCE:'Ожидание / тишина',ERROR:'Ошибка',STARTING:'Запуск'};
export default function RadioControlRoom({token,onOpen}){
 const [data,setData]=useState(null),[worker,setWorker]=useState(null),[error,setError]=useState('');
 const [now,setNow]=useState(()=>Date.now()),[details,setDetails]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const report=await api('/radio-agent/dashboard',{token});setData(report);setError('');
   try{setWorker(await api('/radio-agent/dashboard/worker',{token}));}
   catch{setWorker(null);}
  }catch(e){setError(e.message||'Мониторинг недоступен');setData(null);setWorker(null);}
 },[token]);
 useEffect(()=>{void refresh();const interval=setInterval(refresh,5000);return()=>clearInterval(interval);},[refresh]);
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[]);
 const track=data?.cursor?.track;
 const current=data?.cursor?.slot;
 const offset=track?.offsetMs||0;
 const fraction=track?.durationMs>0?Math.min(100,Math.max(0,100*offset/track.durationMs)):0;
 const isWorking=worker&&worker.mode!=='ERROR'&&worker.mode!=='SILENCE';
 const cards=[
  ['Сервер вещания',worker?modes[worker.mode]||worker.mode:'Нет связи',Boolean(worker)],
  ['Слушателей',worker?.connected??'—',Boolean(worker)],
  ['Записей Auto-DJ',data?.autoDj?.trackCount??'—',data?.autoDj?.ready===true],
  ['Радиокомпьютеров',data?.devices?.filter(d=>d.lastSeenAt&&now-new Date(d.lastSeenAt).getTime()<90000).length??'—',Boolean(data)],
 ];
 return <div className="space-y-4">
  <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
   <section className="relative overflow-hidden rounded-2xl border border-current/10 bg-slate-900 p-5 text-white shadow-xl sm:p-6">
    <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl"/>
    <div className="relative flex flex-wrap items-center justify-between gap-3">
     <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-slate-400">Сейчас в эфире</p>
     <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isWorking?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current"/>{worker?modes[worker.mode]||worker.mode:'Связь не подтверждена'}
     </span>
    </div>
    <h2 className="relative mt-6 min-h-16 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">
     {current?.name|| (data?.cursor?.status==='AUTO_DJ'?'Музыкальная ротация':'Нет подтверждённой передачи')}
    </h2>
    <p className="relative mt-2 truncate text-base text-slate-300">{track?.name||'Информация о текущей записи появится после запуска Worker'}</p>
    <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Прогресс записи" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction)}>
     <div className="h-full rounded-full bg-indigo-400 transition-[width]" style={{width:fraction+'%'}}/>
    </div>
    <div className="relative mt-2 flex justify-between text-xs font-medium tabular-nums text-slate-400">
     <span>{track?duration(offset):'—'}</span><span>{track?duration(track.durationMs):'—'}</span>
    </div>
    {error&&<p role="alert" className="relative mt-3 text-sm text-rose-300">{error}</p>}
    {worker?.lastError&&<p role="alert" className="relative mt-3 text-sm text-rose-300">{worker.lastError}</p>}
    <div className="relative mt-6 flex flex-wrap gap-2">
     <button onClick={()=>onOpen('studio')} type="button" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-200">Открыть студию ↗</button>
     <button onClick={()=>onOpen('schedule')} type="button" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Сетка вещания</button>
    </div>
   </section>
   <section className="flex flex-col justify-between rounded-2xl border border-current/10 bg-white/70 p-5 dark:bg-slate-800/70">
    <div>
     <p className="text-[11px] font-semibold uppercase tracking-widest opacity-55">Время станции · Москва</p>
     <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{new Date(now).toLocaleTimeString('ru-RU',{timeZone:z,hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p>
     <p className="mt-1 text-sm opacity-60">{new Date(now).toLocaleDateString('ru-RU',{timeZone:z,weekday:'long',day:'numeric',month:'long'})}</p>
    </div>
    <div className="mt-8 border-t border-current/10 pt-4">
     <p className="text-xs font-semibold uppercase tracking-wider opacity-55">Следующее событие</p>
     {data?.upcoming?.length?<div className="mt-2 space-y-1"><p className="text-lg font-semibold">{data.upcoming[0].name||data.upcoming[0].playlist?.name||'Передача'}</p>
       <p className="text-sm opacity-65">{displayTime(data.upcoming[0].startAt)}</p></div>:<p className="mt-2 text-sm opacity-65">Ближайшие передачи не найдены</p>}
    </div>
   </section>
  </div>
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   {cards.map(([title,value,healthy])=><section key={title} className="min-w-0 rounded-2xl border border-current/10 bg-white/60 p-4 dark:bg-slate-800/55">
    <span className="text-xs opacity-60">{title}</span>
    <div className="mt-3 flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${healthy?'bg-emerald-500':'bg-amber-500'}`}/>
     <strong className="min-w-0 truncate text-lg">{value}</strong></div>
   </section>)}
  </div>
  <section className="rounded-2xl border border-current/10 bg-white/60 p-4 dark:bg-slate-800/55">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h3 className="font-semibold">Подготовка эфира</h3><p className="text-xs opacity-60">Рабочие инструменты на отдельных экранах — без перегруженной главной страницы</p></div>
    <button type="button" onClick={refresh} className="rounded-xl border border-current/15 px-3 py-2 text-sm">Обновить ↻</button>
   </div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {[['playlists','☷','Собрать плейлист'],['assets','♫','Открыть аудиотеку'],['automation','⟳','Настроить Auto-DJ'],['history','◷','Посмотреть историю']].map(([id,icon,label])=>
     <button key={id} type="button" onClick={()=>onOpen(id)} className="flex items-center gap-3 rounded-xl border border-current/10 bg-white/60 px-3 py-4 text-left text-sm font-semibold transition hover:border-indigo-400/50 hover:bg-indigo-500/5 dark:bg-slate-900/40">
      <span className="text-xl" aria-hidden>{icon}</span>{label}<span className="ml-auto opacity-40">→</span></button>)}
   </div>
  </section>
  <div className="text-right"><button type="button" onClick={()=>setDetails(v=>!v)} className="rounded-xl border border-current/10 px-4 py-2 text-xs opacity-75">{details?'Скрыть сведения':'Дополнительные сведения о состоянии'}</button></div>
  {details&&<section className="rounded-xl border border-current/10 p-4 text-sm"><p>Статус: {data?.cursor?.status||'—'} · Поток: {data?.stream?.status||'—'} · Воспроизведение: {worker?.mode||'—'}</p><p className="mt-2 opacity-65">Данные поступают от существующих API. Мониторинг не включает эфир и не управляет усилителем.</p></section>}
 </div>;
}
