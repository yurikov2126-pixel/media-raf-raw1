import {useEffect,useMemo,useState} from 'react';
import './radio-schedule-v3.css';
const zone='Europe/Moscow',HOUR=58,DAY_START=0,HOURS=24;
export const scheduleDayKey=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const scheduleAddDays=(key,days)=>{const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const clock=value=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const readable=value=>new Date(value).toLocaleDateString('ru-RU',{timeZone:zone,weekday:'short',day:'numeric',month:'short'});
const minutes=value=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));return Number(parts.find(x=>x.type==='hour')?.value)*60+Number(parts.find(x=>x.type==='minute')?.value);};
export const scheduleConflict=(events,event)=>events.some(x=>x.id!==event.id&&Date.parse(x.startAt)<Date.parse(event.endAt)&&Date.parse(event.startAt)<Date.parse(x.endAt));
export function scheduleLayout(events,day){
 const start=Date.parse(day+'T00:00:00+03:00'),end=start+86400000;
 const visible=events.filter(e=>Date.parse(e.startAt)<end&&Date.parse(e.endAt)>start);
 const placed=visible.map(e=>{
  const top=Math.max(0,(Math.max(start,Date.parse(e.startAt))-start)/60000);
  const bottom=Math.min(1440,(Math.min(end,Date.parse(e.endAt))-start)/60000);
  return {...e,top,duration:Math.max(1,bottom-top)};
 }).sort((a,b)=>a.top-b.top||b.duration-a.duration);
 const clusters=[];let cluster=[],clusterEnd=-1;
 for(const event of placed){
  if(cluster.length&&event.top>=clusterEnd){clusters.push(cluster);cluster=[];clusterEnd=-1;}
  cluster.push(event);clusterEnd=Math.max(clusterEnd,event.top+event.duration);
 }
 if(cluster.length)clusters.push(cluster);
 return clusters.flatMap(group=>{
  const ends=[];
  const assigned=group.map(item=>{
   let lane=ends.findIndex(t=>t<=item.top);
   if(lane<0){lane=ends.length;ends.push(0);}
   ends[lane]=item.top+item.duration;
   return {...item,lane};
  });
  return assigned.map(item=>({...item,lanes:ends.length}));
 });
}
const palette=['radio-v3-event-music','radio-v3-event-show','radio-v3-event-other'];
export default function RadioScheduleBoard({slots=[],date,onDateChange,onSelectSlot,onDropSlot,onCreate,onCreateAt}){
 const [view,setView]=useState('week'),[selectedDay,setSelectedDay]=useState(date);
 const [dragId,setDragId]=useState(null),[nowMs,setNowMs]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNowMs(Date.now()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(window.matchMedia('(max-width: 767px)').matches)setView('day');
 },[]);
 useEffect(()=>{if(selectedDay<date||selectedDay>scheduleAddDays(date,6))setSelectedDay(date);},[date,selectedDay]);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>scheduleAddDays(date,i)),[date]);
 const events=useMemo(()=>slots.filter(s=>s?.startAt&&s?.endAt&&Number.isFinite(Date.parse(s.startAt))&&Number.isFinite(Date.parse(s.endAt)))
  .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),[slots]);
 const today=scheduleDayKey(new Date(nowMs));
 const dayEvents=useMemo(()=>scheduleLayout(events,selectedDay),[events,selectedDay]);
 const scheduleForDay=day=>scheduleLayout(events,day);
 const moveToDay=(event,day)=>{if(Date.parse(event.startAt)>Date.now())onDropSlot?.(event,day);};
 const drop=(e,day)=>{e.preventDefault();const target=events.find(s=>s.id===dragId);setDragId(null);if(target)moveToDay(target,day);};
 const startDrag=(e,id)=>{setDragId(id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);};
 const card=(event,index,positioned=false)=> {
  const active=Date.parse(event.startAt)<=nowMs&&Date.parse(event.endAt)>nowMs;
  const future=Date.parse(event.startAt)>nowMs, conflict=scheduleConflict(events,event);
  const title=event.playlist?.name||event.title||'Передача';
  return <button key={event.id} type="button" draggable={future} onDragStart={e=>startDrag(e,event.id)}
   onDragEnd={()=>setDragId(null)} onClick={e=>{e.stopPropagation();onSelectSlot?.(event);}}
   onContextMenu={e=>{e.preventDefault();onSelectSlot?.(event);}}
   title={title+' · '+clock(event.startAt)+'–'+clock(event.endAt)}
   className={'radio-v3-event group overflow-hidden rounded-xl border text-left '+palette[index%palette.length]+(active?' radio-v3-event-live':'')+(conflict?' radio-v3-event-conflict':'')+(positioned?' absolute px-2 py-1.5':' w-full p-3')}
   style={positioned?{top:event.top/60*HOUR+2,height:Math.max(25,event.duration/60*HOUR-4),left:'calc('+event.lane+'/'+event.lanes+' * 100% + 3px)',width:'calc(100% / '+event.lanes+' - 6px)'}:undefined}>
   <span className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">{active&&<span className="radio-v3-live-dot"/>}{clock(event.startAt)}–{clock(event.endAt)}</span>
   <span className="block truncate text-xs font-semibold sm:text-sm">{title}</span>
   {(!positioned||event.duration>=45)&&<span className="block truncate text-[10px] opacity-75">{event.playlistId?'Музыкальный блок / передача':'План без плейлиста'}</span>}
   {conflict&&<span className="block text-[10px] font-bold text-rose-600 dark:text-rose-300">⚠ Конфликт времени</span>}
  </button>;
 };
 const timeline=(day,items)=>{
  const nowMinute=day===today?minutes(nowMs):null;
  return <div className="radio-v3-day-timeline relative" style={{height:HOURS*HOUR}} onDragOver={e=>{if(dragId)e.preventDefault();}}
   onDrop={e=>drop(e,day)} onClick={e=>{
    if(!onCreateAt||e.target!==e.currentTarget)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const offset=Math.max(0,Math.min(1439,Math.floor((e.clientY-rect.top)/HOUR*60/15)*15));
    onCreateAt(day+'T'+String(Math.floor(offset/60)).padStart(2,'0')+':'+String(offset%60).padStart(2,'0'));
   }}>
   {Array.from({length:HOURS},(_,i)=><div key={i} className="radio-v3-hour-line" style={{top:i*HOUR}}/>)}
   {nowMinute!==null&&<div className="radio-v3-now-line" style={{top:nowMinute/60*HOUR}}><span>Сейчас</span></div>}
   {items.map((e,i)=>card(e,i,true))}
  </div>;
 };
 return <section className="space-y-3" aria-label="Эфирная сетка Radio 3.0">
  <header className="radio-v3-schedule-toolbar flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-current/15 p-4">
   <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">RADIO 3.0 · МОСКВА UTC+3</p>
    <h2 className="mt-1 text-lg font-bold">Эфирная сетка</h2>
    <p className="text-xs opacity-65">{readable(date+'T12:00:00Z')} — {readable(days[6]+'T12:00:00Z')} · {events.length} записей в загруженной выборке</p></div>
   <div className="flex flex-wrap items-center gap-2">
    <button type="button" className="radio-v3-schedule-btn" onClick={()=>onDateChange(scheduleAddDays(date,-7))} aria-label="Предыдущая неделя">←</button>
    <button type="button" className="radio-v3-schedule-btn" onClick={()=>onDateChange(today)}>Сегодня</button>
    <button type="button" className="radio-v3-schedule-btn" onClick={()=>onDateChange(scheduleAddDays(date,7))} aria-label="Следующая неделя">→</button>
    <select className="radio-v3-schedule-btn" value={view} onChange={e=>setView(e.target.value)} aria-label="Вид календаря">
     <option value="week">Неделя</option><option value="day">День</option><option value="list">Список</option>
    </select>
    <button type="button" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white" onClick={onCreate}>＋ Передача</button>
   </div>
  </header>
  <nav className="radio-v3-day-strip flex gap-1 overflow-x-auto rounded-xl p-1" aria-label="Выбор дня">
   {days.map(day=><button type="button" key={day} onClick={()=>{setSelectedDay(day);setView('day');}}
    aria-current={selectedDay===day?'date':undefined} className={'min-w-[84px] flex-1 rounded-xl px-2 py-2 text-center text-xs '+(selectedDay===day?'radio-v3-day-active':'hover:bg-violet-500/10')}>
    <span className="block font-bold">{readable(day+'T12:00:00Z')}</span><span className="block opacity-65">{scheduleForDay(day).length} событий</span>
   </button>)}
  </nav>
  {view==='week'&&<div className="radio-v3-week-scroll overflow-x-auto rounded-2xl border border-current/15" tabIndex={0} role="region" aria-label="Прокручиваемая сетка вещания за неделю">
   <div className="radio-v3-week-grid min-w-[910px]">
    <div className="radio-v3-time-column"><div className="radio-v3-day-heading">Время</div>
     <div className="relative" style={{height:HOURS*HOUR}}>
      {Array.from({length:HOURS},(_,i)=><span key={i} className="radio-v3-hour-label" style={{top:i*HOUR-7}}>{String(i).padStart(2,'0')}:00</span>)}
     </div>
    </div>
    {days.map(day=><div className="min-w-0 border-l border-current/10" key={day}>
     <button type="button" onClick={()=>{setSelectedDay(day);setView('day');}}
      className={'radio-v3-day-heading w-full '+(day===today?'radio-v3-today':'')}>{readable(day+'T12:00:00Z')}</button>
     {timeline(day,scheduleForDay(day))}
    </div>)}
   </div>
  </div>}
  {view==='day'&&<div className="overflow-hidden rounded-2xl border border-current/15">
   <div className="radio-v3-day-grid">
    <div className="relative" style={{height:HOURS*HOUR}}>
     {Array.from({length:HOURS},(_,i)=><span key={i} className="radio-v3-hour-label" style={{top:i*HOUR-7}}>{String(i).padStart(2,'0')}:00</span>)}
    </div>
    {timeline(selectedDay,dayEvents)}
   </div>
  </div>}
  {view==='list'&&<div className="space-y-2 rounded-2xl border border-current/15 p-3">
   {events.length?events.map((e,i)=>card(e,i)):<p className="p-5 text-center text-sm opacity-65">В выбранном периоде нет передач.</p>}
  </div>}
  <p className="text-xs opacity-65">Нажмите на событие, чтобы открыть действия. Будущие события можно переносить; сервер проверяет конфликты. На мобильном используйте режим «День» и меню события. Пустое место в расписании не подтверждает фактический запуск AutoDJ.</p>
 </section>;
}
