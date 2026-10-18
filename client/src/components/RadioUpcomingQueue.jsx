const zone='Europe/Moscow';
const time=v=>v?new Date(v).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'}):'—';
const day=v=>v?new Date(v).toLocaleDateString('ru-RU',{timeZone:zone,weekday:'short',day:'numeric',month:'short'}):'—';
export default function RadioUpcomingQueue({entries,onSchedule}){
 const queue=Array.isArray(entries)?entries.slice(0,6):[];
 return <section className="min-w-0 rounded-2xl border border-current/10 bg-white/60 p-4 dark:bg-slate-800/55 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[11px] font-bold uppercase tracking-[.13em] opacity-55">План эфира</p>
    <h3 className="mt-1 text-lg font-bold">Ближайшие передачи</h3></div>
   <button type="button" onClick={onSchedule} className="rounded-xl border border-current/15 px-3 py-2 text-xs font-semibold hover:bg-indigo-500/10">Открыть сетку →</button>
  </div>
  {queue.length?<ol className="mt-4 space-y-2">
    {queue.map((event,index)=><li key={event.id||index} className="flex min-w-0 items-center gap-3 rounded-xl border border-current/10 bg-white/55 p-3 dark:bg-slate-900/40">
     <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-indigo-500/10 px-2 py-2 text-indigo-700 dark:text-indigo-300">
      <strong className="text-sm tabular-nums">{time(event.startAt)}</strong>
      <span className="text-[10px] whitespace-nowrap">{day(event.startAt)}</span>
     </div>
     <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.name||event.playlist?.name||'Радиопередача'}</p>
      <p className="mt-1 text-xs opacity-55">До {time(event.endAt)} · {index===0?'Следующая по плану':'Запланировано'}</p></div>
     <span aria-hidden className="text-lg opacity-30">›</span>
    </li>)}
   </ol>:<div className="mt-4 rounded-xl border border-dashed border-current/15 p-6 text-center text-sm opacity-65">
    В ближайшей выборке расписания нет передач. Откройте сетку, чтобы добавить эфир.
   </div>}
 </section>;
}
