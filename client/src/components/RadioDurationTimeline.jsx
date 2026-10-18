import { useMemo } from 'react';

const HOUR_PX = 56;
const DAY_MS = 86400000;
const ZONE_MS = 3 * 3600000;
const time = date => new Date(date).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
const dayLabel = date => new Date(date).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',weekday:'short',day:'2-digit',month:'2-digit'});
const fmt = ms => { const min = Math.round(ms / 60000); return min >= 60 ? Math.floor(min/60)+' ч '+String(min%60).padStart(2,'0')+' мин' : min+' мин'; };

/**
 * Time-proportional weekly view. Absolute UTC timestamps are converted to
 * Moscow's fixed UTC+03 station clock; overnight shows on both affected days.
 */
export default function RadioDurationTimeline({ weekStart, slots, onOpen }) {
  const base = Date.parse(weekStart+'T00:00:00+03:00');
  const days = useMemo(()=>Array.from({length:7},(_,i)=>{
    const start=base+i*DAY_MS, end=start+DAY_MS;
    const entries=slots.flatMap(slot=>{
      const from=Date.parse(slot.startAt), to=Date.parse(slot.endAt);
      if(!(from<end && to>start && Number.isFinite(from) && Number.isFinite(to)))return[];
      return [{slot,top:Math.max(0,(Math.max(from,start)-start)/3600000*HOUR_PX),
        height:Math.max(3,(Math.min(to,end)-Math.max(from,start))/3600000*HOUR_PX),
        continuation:from<start}];
    });
    return {date:new Date(start),start,entries};
  }),[base,slots]);
  const now=Date.now();
  const hourLine=(now-base)/3600000*HOUR_PX;
  return <section className="space-y-2 rounded-2xl border border-current/10 p-3" aria-label="Сетка вещания по длительности">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-semibold">Недельная шкала эфиров</h3>
      <span className="text-xs opacity-65">Москва UTC+3 · масштаб: 1 час = {HOUR_PX} пикселей</span>
    </div>
    <p className="text-xs opacity-65">Длина каждой карточки равна времени вещания. Передачи через полночь продолжаются в следующем дне. Нажмите на передачу для действий.</p>
    <div className="max-h-[65vh] overflow-auto rounded-xl border border-current/10">
      <div className="min-w-[780px]">
        <div className="sticky top-0 z-20 grid grid-cols-[54px_repeat(7,minmax(102px,1fr))] border-b border-current/10 bg-slate-100 text-xs font-semibold text-slate-950 dark:bg-slate-900 dark:text-white">
          <span className="p-2">UTC+3</span>
          {days.map(day=><span key={day.start} className="border-l border-current/10 p-2">{dayLabel(day.start)}</span>)}
        </div>
        <div className="grid grid-cols-[54px_repeat(7,minmax(102px,1fr))]">
          <div className="relative" style={{height:24*HOUR_PX}}>
            {Array.from({length:24},(_,h)=><span key={h} className="absolute left-1 text-[10px] tabular-nums opacity-65" style={{top:h*HOUR_PX}}>{String(h).padStart(2,'0')}:00</span>)}
          </div>
          {days.map(day=><div key={day.start} className="relative border-l border-current/10" style={{height:24*HOUR_PX,backgroundImage:'repeating-linear-gradient(to bottom, transparent 0px, transparent '+(HOUR_PX-1)+'px, currentColor '+(HOUR_PX-1)+'px, currentColor '+HOUR_PX+'px)',backgroundSize:'100% '+HOUR_PX+'px'}}>
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{background:'var(--text-primary, currentColor)'}}/>
            {day.entries.map(({slot,top,height,continuation})=><button key={slot.id} type="button"
              onClick={()=>onOpen(slot)}
              title={slot.playlist.name+' · '+time(slot.startAt)+'–'+time(slot.endAt)+' · '+fmt(new Date(slot.endAt)-new Date(slot.startAt))}
              className="absolute left-1 right-1 z-10 overflow-hidden rounded-lg border-l-4 border-blue-500 bg-blue-500/20 px-1.5 py-1 text-left text-[10px] leading-tight text-slate-900 shadow-sm hover:bg-blue-500/30 focus:outline focus:outline-2 focus:outline-blue-500 dark:text-white"
              style={{top:top+1,height:Math.max(4,height-2)}} aria-label={'Действия: '+slot.playlist.name}>
              <span className="block font-bold">{continuation?'↳ ':''}{time(slot.startAt)} · {fmt(new Date(slot.endAt)-new Date(slot.startAt))}</span>
              <span className="block break-words font-medium">{slot.playlist.name}</span>
            </button>)}
            {now>=day.start&&now<day.start+DAY_MS&&<div className="absolute left-0 right-0 z-10 border-t-2 border-red-500 pointer-events-none" style={{top:(now-day.start)/3600000*HOUR_PX}} aria-hidden="true"/>}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
