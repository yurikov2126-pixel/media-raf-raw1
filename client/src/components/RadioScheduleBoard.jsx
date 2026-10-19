import {useMemo,useState} from 'react';
const zone='Europe/Moscow';
const dayKey=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const clock=value=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const readable=value=>new Date(value).toLocaleDateString('ru-RU',{timeZone:zone,weekday:'short',day:'numeric',month:'short'});
const addDays=(key,days)=>{const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
const colors=['radio-schedule-event-indigo','radio-schedule-event-teal','radio-schedule-event-fuchsia'];
export default function RadioScheduleBoard({slots,date,onDateChange,onSelectSlot,onCreate}){
 const [view,setView]=useState('week');
 const dates=useMemo(()=>Array.from({length:7},(_,i)=>addDays(date,i)),[date]);
 const entries=useMemo(()=>slots.filter(s=>s?.startAt&&s?.endAt).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)),[slots]);
 const groups=useMemo(()=>Object.fromEntries(dates.map(day=>[day,entries.filter(item=>dayKey(new Date(item.startAt))===day)])),[dates,entries]);
 const now=dayKey(new Date());
 const timeConflict=event=>entries.some(item=>item.id!==event.id&&new Date(item.startAt)<new Date(event.endAt)&&new Date(event.startAt)<new Date(item.endAt));
 return <section className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-current/10 bg-white/60 p-4 dark:bg-slate-900/50">
   <div><p className="text-xs font-semibold uppercase tracking-[.14em] opacity-50">PROGRAM LOG · МОСКВА UTC+3</p>
    <h3 className="mt-1 font-bold">Эфирная неделя</h3><p className="text-xs opacity-60">{readable(date+'T12:00:00Z')} — {readable(dates[6]+'T12:00:00Z')} · {entries.length} передач</p></div>
   <div className="flex flex-wrap gap-2">
    <button className="rounded-xl border border-current/15 px-3 py-2 text-sm" onClick={()=>onDateChange(addDays(date,-7))} aria-label="Предыдущая неделя">←</button>
    <button className="rounded-xl border border-current/15 px-3 py-2 text-sm" onClick={()=>onDateChange(now)}>Сегодня</button>
    <button className="rounded-xl border border-current/15 px-3 py-2 text-sm" onClick={()=>onDateChange(addDays(date,7))} aria-label="Следующая неделя">→</button>
    <select className="rounded-xl border border-current/15 bg-transparent px-2 text-sm" aria-label="Отображение расписания" value={view} onChange={e=>setView(e.target.value)}><option value="week">Неделя</option><option value="list">Хронология</option></select>
    <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={onCreate}>＋ Передача</button>
   </div>
  </div>
  {view==='week'?<div className="radio-schedule-grid overflow-x-auto rounded-2xl border radio-surface-soft">
   <div className="radio-schedule-columns grid min-w-[780px] grid-cols-7 divide-x">
    {dates.map((day,index)=><div key={day} className="min-w-0">
     <div className={`sticky top-0 z-10 border-b border-current/10 p-3 text-center text-xs font-semibold ${day===now?'radio-schedule-day-today':'radio-schedule-day'}`}>
      {readable(day+'T12:00:00Z')}
      <span className="mt-1 block text-[10px] opacity-70">{groups[day].length} событий</span>
     </div>
     <div className="radio-schedule-day-body min-h-64 space-y-2 p-2">
      {groups[day].map((event,j)=><button key={event.id} onClick={()=>onSelectSlot(event)} title="Открыть действия с передачей" className={`radio-schedule-event w-full rounded-xl border p-2.5 text-left transition ${colors[index%colors.length]}`}>
       <span className="block text-xs font-bold tabular-nums">{clock(event.startAt)} — {clock(event.endAt)}</span>
       <span className="mt-1 block break-words text-xs font-semibold">{event.playlist?.name||event.name||'Передача'}</span>
       {timeConflict(event)&&<span className="mt-1 block text-[10px] font-bold text-rose-500">⚠ Пересечение</span>}
      </button>)}
      {!groups[day].length&&<p className="radio-schedule-empty pt-6 text-center text-xs">Auto-DJ / без событий</p>}
     </div>
    </div>)}
   </div>
  </div>:<div className="overflow-hidden rounded-2xl border border-current/10 radio-surface-soft">
   {entries.length?entries.map(event=><button type="button" key={event.id} onClick={()=>onSelectSlot(event)} className="flex w-full items-center gap-3 border-b border-current/10 p-3 text-left last:border-0 hover:bg-indigo-500/10">
    <span className="w-24 shrink-0 text-xs font-semibold tabular-nums">{readable(event.startAt)}</span>
    <span className="w-24 shrink-0 text-xs tabular-nums">{clock(event.startAt)}</span>
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{event.playlist?.name||event.name||'Передача'}</span>
    {timeConflict(event)&&<span className="shrink-0 text-xs text-rose-500">Пересечение</span>}
    <span className="opacity-50">›</span>
   </button>):<p className="p-6 text-center text-sm opacity-60">Нет передач на выбранной неделе</p>}
  </div>}
  <p className="text-xs opacity-55">Сетка показывает уже сохранённые передачи. Изменения времени и конфликты окончательно проверяются сервером. Заполнение свободных часов музыкой Auto-DJ в этом представлении условное.</p>
 </section>;
}
