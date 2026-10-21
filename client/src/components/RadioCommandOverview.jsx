import {useMemo,useState} from 'react';
const zone='Europe/Moscow';
const fmt=value=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const secs=ms=>{const n=Math.max(0,Math.ceil(ms/60000));return n<60?n+' мин':Math.floor(n/60)+' ч '+String(n%60).padStart(2,'0')+' мин';};
export default function RadioCommandOverview({slots=[],playlists=[],assets=[],onOpen,onRefresh,refreshing=false}){
 const [showAll,setShowAll]=useState(false);
 const [showStats,setShowStats]=useState(false);
 const [filter,setFilter]=useState('all');
 const upcoming=useMemo(()=>slots.filter(s=>s?.endAt&&Date.parse(s.endAt)>Date.now())
  .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),[slots]);
 const visible=upcoming.filter(s=>filter==='all'||(filter==='scheduled'?!!s.playlistId:!s.playlistId));
 const next=upcoming[0];
 const live=next&&Date.parse(next.startAt)<=Date.now()?next:null;
 const published=playlists.filter(p=>p.status==='APPROVED').length;
 return <section className="radio-v3-overview space-y-3" aria-label="Рабочая панель радиостанции">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[11px] font-bold uppercase tracking-widest opacity-55">RADIO 3.0 · РАБОЧИЙ ЦЕНТР</p>
    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Управление эфиром</h2>
    <p className="mt-1 text-sm opacity-65">Мониторинг звучания ниже · быстрые рабочие действия здесь</p></div>
   <button onClick={onRefresh} disabled={refreshing} className="rounded-xl border border-current/15 px-3 py-2 text-sm" type="button">
    {refreshing?'Обновление…':'↻ Обновить данные'}
   </button>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <button type="button" aria-expanded={showStats} onClick={()=>setShowStats(v=>!v)}
    className="rounded-xl border border-current/20 px-3 py-2 text-sm font-semibold">{showStats?'▾ Скрыть статистику':'▸ Показать статистику'}</button>
   <button type="button" onClick={()=>onOpen('schedule')} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">＋ Эфирная сетка</button>
   <button type="button" onClick={()=>onOpen('studio')} className="rounded-xl border border-current/20 px-4 py-2 text-sm font-semibold">◉ Студия</button>
  </div>
  {showStats&&<div className="grid gap-3 sm:grid-cols-3">
   <div className="radio-v3-stat rounded-2xl border border-current/10 p-4">
    <p className="text-xs opacity-60">Аудиотека</p><p className="mt-1 text-2xl font-bold tabular-nums">{assets.length}</p>
    <button type="button" className="mt-2 text-sm font-semibold text-violet-700 dark:text-violet-300" onClick={()=>onOpen('assets')}>Открыть записи ↗</button>
   </div>
   <div className="radio-v3-stat rounded-2xl border border-current/10 p-4">
    <p className="text-xs opacity-60">Утверждённые плейлисты</p><p className="mt-1 text-2xl font-bold tabular-nums">{published}</p>
    <button type="button" className="mt-2 text-sm font-semibold text-violet-700 dark:text-violet-300" onClick={()=>onOpen('playlists')}>Редактор ↗</button>
   </div>
   <div className="radio-v3-stat rounded-2xl border border-current/10 p-4">
    <p className="text-xs opacity-60">Эфирных событий в выборке</p><p className="mt-1 text-2xl font-bold tabular-nums">{slots.length}</p>
    <button type="button" className="mt-2 text-sm font-semibold text-violet-700 dark:text-violet-300" onClick={()=>onOpen('schedule')}>Сетка вещания ↗</button>
   </div>
  </div>}
  <div className="grid gap-3 grid-cols-1">
   <div className="radio-v3-stat rounded-2xl border border-current/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Ближайшие события сетки</h3>
     <select aria-label="Фильтр сетки" value={filter} onChange={e=>setFilter(e.target.value)}
      className="rounded-lg border border-current/20 bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-900 dark:text-white">
      <option value="all">Все</option><option value="scheduled">С плейлистом</option><option value="planning">Планы</option>
     </select></div>
     <button type="button" onClick={()=>setShowAll(v=>!v)} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs">
      {showAll?'Свернуть':'Показать все'}
     </button>
    </div>
    <div className="mt-3 space-y-2">
     {!visible.length&&<p className="text-sm opacity-65">В загруженном интервале нет запланированных передач.</p>}
     {visible.slice(0,showAll?20:4).map(s=>{
      const started=Date.parse(s.startAt)<=Date.now();
      return <button key={s.id} type="button" onClick={()=>onOpen("schedule")} title="Открыть передачу в сетке" className="flex w-full items-center gap-3 rounded-xl border border-current/20 p-3 text-left transition-colors hover:bg-violet-500/10">
       <span className={'h-9 w-1 shrink-0 rounded-full '+(started?'bg-rose-500':'bg-violet-500')}/>
       <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{s.playlist?.name||s.title||'Передача'}</p>
        <p className="text-xs opacity-60">{fmt(s.startAt)}–{fmt(s.endAt)} · {started?'В пределах запланированного времени':'Через '+secs(Date.parse(s.startAt)-Date.now())}</p>
       </div>
       <span className="text-[11px] opacity-75">{s.playlistId?'Плейлист':'План'} ↗</span>
      </button>;
     })}
    </div>
    <p className="mt-3 text-xs opacity-55">Это расписание, не подтверждение фактического звучания. Реальный источник показывается эфирным монитором.</p>
   </div>
  </div>
 </section>;
}
