import {useMemo,useState} from 'react';
const zone='Europe/Moscow';
const fmt=value=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const secs=ms=>{const n=Math.max(0,Math.ceil(ms/60000));return n<60?n+' мин':Math.floor(n/60)+' ч '+String(n%60).padStart(2,'0')+' мин';};
export default function RadioCommandOverview({slots=[],playlists=[],assets=[],onOpen,onRefresh,refreshing=false}){
 const [showAll,setShowAll]=useState(false);
 const upcoming=useMemo(()=>slots.filter(s=>s?.endAt&&Date.parse(s.endAt)>Date.now())
  .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),[slots]);
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
  <div className="grid gap-3 sm:grid-cols-3">
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
  </div>
  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,.65fr)]">
   <div className="radio-v3-stat rounded-2xl border border-current/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="font-semibold">Ближайшие события сетки</h3>
     <button type="button" onClick={()=>setShowAll(v=>!v)} className="rounded-lg border border-current/15 px-3 py-1.5 text-xs">
      {showAll?'Свернуть':'Показать все'}
     </button>
    </div>
    <div className="mt-3 space-y-2">
     {!upcoming.length&&<p className="text-sm opacity-65">В загруженном интервале нет запланированных передач.</p>}
     {upcoming.slice(0,showAll?20:4).map(s=>{
      const started=Date.parse(s.startAt)<=Date.now();
      return <div key={s.id} className="flex items-center gap-3 rounded-xl border border-current/10 p-3">
       <span className={'h-9 w-1 shrink-0 rounded-full '+(started?'bg-rose-500':'bg-violet-500')}/>
       <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{s.playlist?.name||s.title||'Передача'}</p>
        <p className="text-xs opacity-60">{fmt(s.startAt)}–{fmt(s.endAt)} · {started?'В пределах запланированного времени':'Через '+secs(Date.parse(s.startAt)-Date.now())}</p>
       </div>
       <span className="text-[11px] opacity-60">{s.playlistId?'Плейлист':'План'}</span>
      </div>;
     })}
    </div>
    <p className="mt-3 text-xs opacity-55">Это расписание, не подтверждение фактического звучания. Реальный источник показывается эфирным монитором.</p>
   </div>
   <div className="radio-v3-stat flex flex-col gap-3 rounded-2xl border border-current/10 p-4">
    <h3 className="font-semibold">Быстрые действия</h3>
    <button className="radio-v3-action" type="button" onClick={()=>onOpen('schedule')}>＋ Запланировать передачу <span>↗</span></button>
    <button className="radio-v3-action" type="button" onClick={()=>onOpen('auto-playlists')}>♫ Сгенерировать плейлист <span>↗</span></button>
    <button className="radio-v3-action" type="button" onClick={()=>onOpen('studio')}>◉ Открыть студию <span>↗</span></button>
    <button className="radio-v3-action" type="button" onClick={()=>onOpen('history')}>◷ Диагностика эфира <span>↗</span></button>
    <p className="mt-auto text-xs opacity-55">{live?'Сейчас в пределах слота «'+(live.playlist?.name||live.title||'Передача')+'»':'Нет активного события в текущей выборке'}</p>
   </div>
  </div>
 </section>;
}
