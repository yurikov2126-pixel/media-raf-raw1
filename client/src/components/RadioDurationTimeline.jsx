import { useMemo, useState } from 'react';

const DAY = 86400000;
const zone = 'Europe/Moscow';
const clock = value => new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const dayName = value => new Date(value).toLocaleDateString('ru-RU',{timeZone:zone,weekday:'short',day:'numeric'});
const duration = ms => {const n=Math.ceil(ms/60000);return n>=60?Math.floor(n/60)+' ч '+String(n%60).padStart(2,'0')+' мин':n+' мин';};
const midnight = text => Date.parse(text+'T00:00:00+03:00');

export default function RadioDurationTimeline({weekStart,slots=[],onOpen}) {
  const [selected,setSelected]=useState(0);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>{
    const start=midnight(weekStart)+i*DAY, end=start+DAY;
    const entries=slots.filter(s=>Date.parse(s.startAt)<end && Date.parse(s.endAt)>start)
      .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
    return {start,end,entries};
  }),[weekStart,slots]);
  const day=days[selected]||days[0];
  const today=Date.now();
  const summary=days.map(d=>d.entries.length);
  return <section className="space-y-3 rounded-2xl border border-current/15 bg-white/5 p-3 sm:p-4" aria-label="Расписание эфиров">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Расписание эфиров</h3>
      <span className="text-xs opacity-65">Москва · UTC+3</span>
    </div>
    <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Выберите день недели">
      {days.map((d,i)=><button key={d.start} type="button" role="tab" aria-selected={selected===i}
        onClick={()=>setSelected(i)}
        className={'min-w-0 rounded-xl border px-1 py-2 text-center transition-colors '+(selected===i?'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300':'border-current/15 hover:bg-white/10')}>
        <span className="block truncate text-[11px] font-semibold capitalize">{dayName(d.start).split(' ')[0]}</span>
        <span className="block text-base font-bold tabular-nums">{new Date(d.start).toLocaleDateString('ru-RU',{timeZone:zone,day:'numeric'})}</span>
        <span className="block text-[10px] opacity-60">{summary[i]||'—'}</span>
      </button>)}
    </div>
    <div role="tabpanel" className="space-y-2">
      {!day.entries.length && <div className="rounded-xl border border-dashed border-current/20 p-7 text-center text-sm opacity-65">В этот день эфиров нет</div>}
      {day.entries.map((slot,i)=>{
        const from=Date.parse(slot.startAt),to=Date.parse(slot.endAt);
        const displayStart=Math.max(from,day.start),displayEnd=Math.min(to,day.end);
        const previous=i?Date.parse(day.entries[i-1].endAt):day.start;
        const gap=displayStart-Math.max(previous,day.start);
        const running=today>=from&&today<to;
        return <div key={slot.id+'-'+selected} className="space-y-2">
          {gap>=60000 && <div className="flex items-center gap-2 px-2 text-xs opacity-60"><span className="h-px flex-1 bg-current/15"/><span>Свободно · {duration(gap)}</span><span className="h-px flex-1 bg-current/15"/></div>}
          <button type="button" onClick={()=>onOpen(slot)} className={'flex min-h-20 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors sm:p-4 '+(running?'border-red-500/50 bg-red-500/10':'border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/15')}>
            <div className="w-[66px] shrink-0 text-center">
              <div className="text-base font-bold tabular-nums">{clock(displayStart)}</div>
              <div className="text-xs opacity-60">{clock(displayEnd)}</div>
            </div>
            <span className="h-11 w-1 shrink-0 rounded-full bg-blue-500"/>
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-semibold">{slot.playlist?.name||'Передача'}</div>
              <div className="mt-1 text-xs opacity-65">{duration(to-from)}{from<day.start?' · продолжение':''}{to>day.end?' · до следующего дня':''}</div>
              {running&&<div className="mt-1 text-xs font-medium text-red-500">В эфире</div>}
            </div>
            <span className="text-xl opacity-65" aria-hidden="true">⋯</span>
          </button>
        </div>;
      })}
      {day.entries.length>0 && Math.max(0,day.end-Date.parse(day.entries[day.entries.length-1].endAt))>=60000&&
        <p className="py-2 text-center text-xs opacity-60">После последнего эфира — свободное время</p>}
    </div>
  </section>;
}
