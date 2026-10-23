import {useEffect,useMemo,useRef,useState} from 'react';
import './radio-schedule-v3.css';
const zone='Europe/Moscow',HOURS=24;
const ZOOM_STEPS=[36,48,58,72,90,120,180,240,360,480];
export const scheduleDayKey=date=>{if(date===null||date===undefined||date==='')return null;const parsed=new Date(date);return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(parsed):null;};
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
export default function RadioScheduleBoard({slots=[],date,onDateChange,onSelectSlot,onDropSlot,onDeleteSlot,onQuickEdit,onBulkCopy,onBulkDelete,bulkBusy,onCreate,onCreateAt}){
 const [view,setView]=useState('week'),[selectedDay,setSelectedDay]=useState(date);
 const [filter,setFilter]=useState('all');
 const [bulkMode,setBulkMode]=useState(false),[selectedIds,setSelectedIds]=useState([]),[copyWeeks,setCopyWeeks]=useState(1);
 const [autoFit,setAutoFit]=useState(()=>{try{return localStorage.getItem('radio-schedule-auto-fit')!=='false';}catch{return true;}});
 const [expandedCard,setExpandedCard]=useState(null);
 useEffect(()=>{try{localStorage.setItem('radio-schedule-auto-fit',String(autoFit));}catch{/* unavailable */}},[autoFit]);
 const [hourHeight,setHourHeight]=useState(()=>{try{const saved=Number(localStorage.getItem('radio-schedule-hour-height'));return ZOOM_STEPS.includes(saved)?saved:58;}catch{return 58;}});
 useEffect(()=>{try{localStorage.setItem('radio-schedule-hour-height',String(hourHeight));}catch{/* private browsing */}},[hourHeight]);
 const [quickSlot,setQuickSlot]=useState(null);
 const [dragId,setDragId]=useState(null),[dropPreview,setDropPreview]=useState(null),[nowMs,setNowMs]=useState(Date.now());
 // Native HTML drag events can arrive before React commits state updates.
 const dragRef=useRef(null);
 const clearDrag=()=>{dragRef.current=null;setDragId(null);setDropPreview(null);};
 useEffect(()=>{const id=setInterval(()=>setNowMs(Date.now()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(window.matchMedia('(max-width: 767px)').matches)setView('day');
 },[]);
 useEffect(()=>{if(selectedDay<date||selectedDay>scheduleAddDays(date,6))setSelectedDay(date);},[date,selectedDay]);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>scheduleAddDays(date,i)),[date]);
 const events=useMemo(()=>slots.filter(s=>s?.startAt&&s?.endAt&&Number.isFinite(Date.parse(s.startAt))&&Number.isFinite(Date.parse(s.endAt)))
  .filter(s=>filter==='all'||(filter==='assigned'?Boolean(s.playlistId):!s.playlistId))
  .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),[slots,filter]);
 const visibleEvents=useMemo(()=>view==='day'?events.filter(s=>scheduleLayout([s],selectedDay).length>0):events,[events,view,selectedDay]);
 const shortestDuration=useMemo(()=>Math.min(...visibleEvents.filter(s=>Date.parse(s.endAt)>nowMs).map(s=>(Date.parse(s.endAt)-Date.parse(s.startAt))/60000).filter(n=>n>0),Infinity),[visibleEvents,nowMs]);
 const fitHourHeight=Number.isFinite(shortestDuration)?Math.min(480,Math.max(58,Math.ceil(82*60/shortestDuration))):58;
 const HOUR=autoFit?Math.max(hourHeight,fitHourHeight):hourHeight;
 const eligible=useMemo(()=>events.filter(e=>Date.parse(e.startAt)>nowMs),[events,nowMs]);
 const chosen=eligible.filter(e=>selectedIds.includes(e.id));
 const toggleSelection=id=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 useEffect(()=>{setSelectedIds(ids=>ids.filter(id=>eligible.some(e=>e.id===id)));},[eligible]);
 const today=scheduleDayKey(new Date(nowMs));
 const dayEvents=useMemo(()=>scheduleLayout(events,selectedDay),[events,selectedDay]);
 const scheduleForDay=day=>scheduleLayout(events,day);
 const quickEdit=(event,offsetMinutes)=>{
  if(Date.parse(event.startAt)<=Date.now())return;
  const timestamp=Date.parse(event.startAt)+offsetMinutes*60000;
  const key=scheduleDayKey(new Date(timestamp));
  const stamp=clock(new Date(timestamp));
  setQuickSlot(null);
  onQuickEdit?.(event,key+'T'+stamp);
 };
 const getDropPreview=(event,day)=>{
  const rect=event.currentTarget.getBoundingClientRect();
  const target=events.find(item=>item.id===dragRef.current?.id);
  if(!target)return null;
  const duration=(Date.parse(target.endAt)-Date.parse(target.startAt))/60000;
  const raw=((event.clientY-rect.top)/HOUR*60)-(dragRef.current?.offsetMinutes||0);
  const minute=Math.min(Math.max(0,Math.round(raw/5)*5),Math.max(0,Math.floor((1440-duration)/5)*5));
  const startLocal=day+'T'+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const from=Date.parse(startLocal+':00+03:00'),until=from+duration*60000;
  const conflict=from<=Date.now()||events.some(other=>other.id!==target.id&&Date.parse(other.startAt)<until&&Date.parse(other.endAt)>from);
  return {day,startLocal,minute,duration,conflict,title:target.playlist?.name||target.title||'Передача'};
 };
 const drop=(event,day)=>{
  event.preventDefault();
  const preview=getDropPreview(event,day);
  const target=events.find(item=>item.id===dragRef.current?.id);
  clearDrag();
  if(target&&preview)onDropSlot?.(target,preview.startLocal,preview.conflict);
 };
 const startDrag=(event,id)=>{
  const target=events.find(item=>item.id===id);
  if(!target||Date.parse(target.startAt)<=Date.now())return;
  const rect=event.currentTarget.getBoundingClientRect();
  // Keep source and grab offset synchronous across dragstart, dragover and drop.
  dragRef.current={id,offsetMinutes:Math.max(0,Math.min((Date.parse(target.endAt)-Date.parse(target.startAt))/60000,(event.clientY-rect.top)/HOUR*60))};
  setDragId(id);setDropPreview(null);
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);
  // Hide the browser's frozen drag snapshot: the live destination card carries the time.
  const transparent=document.createElement('canvas');transparent.width=1;transparent.height=1;
  event.dataTransfer.setDragImage(transparent,0,0);
 };
 const card=(event,index,positioned=false)=> {
  const active=Date.parse(event.startAt)<=nowMs&&Date.parse(event.endAt)>nowMs;
  const future=Date.parse(event.startAt)>nowMs, conflict=scheduleConflict(events,event);
  const title=event.playlist?.name||event.title||'Передача';
  const compact=positioned&&event.duration/60*HOUR<82;
  return <div key={event.id} className={(positioned?'radio-v3-event-shell absolute':'radio-v3-event-shell')+(dragId===event.id?' radio-v3-event-dragging':'')+(selectedIds.includes(event.id)?' radio-v3-event-selected':'')+(expandedCard===event.id?' radio-v3-event-expanded':'')} style={positioned?{top:event.top/60*HOUR+2,height:Math.max(25,event.duration/60*HOUR-4),left:'calc('+event.lane+'/'+event.lanes+' * 100% + 3px)',width:'calc(100% / '+event.lanes+' - 6px)'}:undefined}><button type="button" draggable={future&&!bulkMode} onDragStart={e=>startDrag(e,event.id)}
   onDragEnd={clearDrag} onClick={e=>{e.stopPropagation();if(bulkMode&&future)toggleSelection(event.id);else onSelectSlot?.(event);}}
   onContextMenu={e=>{e.preventDefault();onSelectSlot?.(event);}}
   title={title+' · '+clock(event.startAt)+'–'+clock(event.endAt)}
   className={'radio-v3-event group rounded-xl border text-left '+(expandedCard===event.id?'radio-v3-event-details ':'overflow-hidden ')+palette[index%palette.length]+(active?' radio-v3-event-live':'')+(conflict?' radio-v3-event-conflict':'')+(positioned?' h-full w-full px-2 py-1.5':' w-full p-3')}
   >
   {bulkMode&&future&&<span className="radio-v3-selection-indicator" aria-hidden="true">{selectedIds.includes(event.id)?'☑':'□'}</span>}
   <span className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">{active&&<span className="radio-v3-live-dot"/>}{clock(event.startAt)}–{clock(event.endAt)}</span>
   <span className={"block text-xs font-semibold sm:text-sm "+(compact&&expandedCard!==event.id?"truncate":"whitespace-normal break-words")}>{title}</span>
   {(!positioned||!compact||expandedCard===event.id)&&<span className="block truncate text-[10px] opacity-75">{event.playlistId?'Музыкальный блок / передача':'План без плейлиста'}</span>}
   {!!event.hosts?.length&&<span className="block truncate text-[10px] font-semibold opacity-80" title={event.hosts.map(h=>h.fullName).join(', ')}>🎙 {event.hosts.map(h=>h.fullName).join(', ')}</span>}
   {conflict&&<span className="block text-[10px] font-bold text-rose-600 dark:text-rose-300">⚠ Конфликт времени</span>}
  </button>
  {compact&&<button type="button" className="radio-v3-expand-card" aria-expanded={expandedCard===event.id} aria-label={'Показать полную информацию: '+title} onClick={e=>{e.stopPropagation();setExpandedCard(expandedCard===event.id?null:event.id);}}>{expandedCard===event.id?'−':'↗'}</button>}
  {future&&!bulkMode&&onQuickEdit&&<button type="button" className="radio-v3-quick-edit" title="Сдвинуть начало передачи" aria-label={'Быстро изменить время: '+title} onClick={e=>{e.stopPropagation();setQuickSlot(quickSlot===event.id?null:event.id);}}>✎</button>}
  {quickSlot===event.id&&future&&<div className="radio-v3-quick-actions">
   <button type="button" onClick={()=>quickEdit(event,-15)}>−15 мин</button>
   <button type="button" onClick={()=>quickEdit(event,15)}>+15 мин</button>
   <button type="button" onClick={()=>{setQuickSlot(null);onSelectSlot?.(event);}}>Изменить…</button>
  </div>}
  </div>;
 };
 const timeline=(day,items)=>{
  const nowMinute=day===today?minutes(nowMs):null;
  return <div className="radio-v3-day-timeline relative" style={{height:HOURS*HOUR,'--radio-hour-height':HOUR+'px'}} onDragOver={e=>{if(!dragRef.current)return;e.preventDefault();e.dataTransfer.dropEffect='move';setDropPreview(getDropPreview(e,day));}}
   onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropPreview(null);}}
   onDrop={e=>drop(e,day)} onClick={e=>{
    if(!onCreateAt||e.target!==e.currentTarget)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const offset=Math.max(0,Math.min(1439,Math.floor((e.clientY-rect.top)/HOUR*60/15)*15));
    onCreateAt(day+'T'+String(Math.floor(offset/60)).padStart(2,'0')+':'+String(offset%60).padStart(2,'0'));
   }}>
   {Array.from({length:HOURS},(_,i)=><div key={i} className="radio-v3-hour-line" style={{top:i*HOUR}}/>)}
   {nowMinute!==null&&<div className="radio-v3-now-line" style={{top:nowMinute/60*HOUR}}><span>Сейчас</span></div>}
   {items.map((e,i)=>card(e,i,true))}
   {dropPreview?.day===day&&<div className={'radio-v3-drag-preview '+(dropPreview.conflict?'radio-v3-drag-invalid':'radio-v3-drag-valid')} style={{top:dropPreview.minute/60*HOUR,height:Math.max(25,dropPreview.duration/60*HOUR)}} aria-hidden="true"><strong>{dropPreview.startLocal.slice(11)}–{clock(Date.parse(dropPreview.startLocal+':00+03:00')+dropPreview.duration*60000)} · {dropPreview.title}</strong><span>{dropPreview.conflict?'Занято или прошедшее время':'Отпустите для переноса · шаг 5 мин'}</span></div>}
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
    <div className="radio-v3-zoom-controls" role="group" aria-label="Масштаб временной шкалы">
     <button type="button" disabled={!autoFit&&hourHeight===ZOOM_STEPS[0]} onClick={()=>{setAutoFit(false);setHourHeight(h=>ZOOM_STEPS[Math.max(0,ZOOM_STEPS.indexOf(h)-1)]);}} aria-label="Уменьшить масштаб сетки" title="Мельче">−</button>
     <span aria-live="polite" title="Фактический масштаб с учётом автомасштаба">{Math.round(HOUR/58*100)}%</span>
     <button type="button" disabled={!autoFit&&hourHeight===ZOOM_STEPS[ZOOM_STEPS.length-1]} onClick={()=>{setAutoFit(false);setHourHeight(h=>ZOOM_STEPS[Math.min(ZOOM_STEPS.length-1,ZOOM_STEPS.indexOf(h)+1)]);}} aria-label="Увеличить масштаб сетки" title="Крупнее">+</button>
     <button type="button" onClick={()=>{setAutoFit(false);setHourHeight(58);}} aria-label="Сбросить масштаб сетки">100%</button>
    </div>
    <button type="button" className={'radio-v3-schedule-btn '+(autoFit?'radio-v3-auto-fit-active':'')} aria-pressed={autoFit} title="Автоматически увеличить масштаб для коротких передач" onClick={()=>setAutoFit(v=>!v)}>Автомасштаб {autoFit?'✓':''}</button>
    <select className="radio-v3-schedule-btn" value={view} onChange={e=>setView(e.target.value)} aria-label="Вид календаря">
     <option value="week">Неделя</option><option value="day">День</option><option value="list">Список</option>
    </select>
    <select className="radio-v3-schedule-btn" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Фильтр заданий сетки">
     <option value="all">Все задания</option><option value="assigned">С плейлистом</option><option value="planning">Планирование</option>
    </select>
    <button type="button" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white" onClick={onCreate}>＋ Передача</button>
   </div>
  </header>
  <div className="radio-v3-bulk-bar">
   <button type="button" className="radio-v3-schedule-btn" aria-pressed={bulkMode} onClick={()=>{setBulkMode(v=>!v);setSelectedIds([]);}}>{bulkMode?'Завершить выбор':'☑ Массовые действия'}</button>
   {bulkMode&&<>
    <span className="text-xs font-semibold">{chosen.length} выбрано</span>
    <button type="button" className="radio-v3-schedule-btn" onClick={()=>setSelectedIds(eligible.filter(e=>Date.parse(e.startAt)<Date.parse(scheduleAddDays(date,7)+'T00:00:00+03:00')&&Date.parse(e.startAt)>=Date.parse(date+'T00:00:00+03:00')).map(e=>e.id))}>Выбрать будущие за неделю</button>
    <button type="button" className="radio-v3-schedule-btn" onClick={()=>setSelectedIds([])}>Снять выбор</button>
    <label className="text-xs">Через <select aria-label="Через сколько недель копировать" className="radio-v3-schedule-btn" value={copyWeeks} onChange={e=>setCopyWeeks(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1} нед.</option>)}</select></label>
    <button type="button" disabled={!chosen.length||bulkBusy} className="radio-v3-schedule-btn" onClick={()=>onBulkCopy?.(chosen.map(e=>e.id),copyWeeks,()=>setSelectedIds([]))}>Копировать в неделю →</button>
    <button type="button" disabled={!chosen.length||bulkBusy} className="radio-v3-schedule-btn radio-v3-bulk-delete" onClick={()=>onBulkDelete?.(chosen.map(e=>e.id),()=>setSelectedIds([]))}>Удалить выбранные</button>
   </>}
  </div>
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
   {events.length?events.map((e,i)=><div key={e.id} className="radio-v3-list-entry">
    <div className="min-w-0 flex-1">{card(e,i)}</div>
    {onDeleteSlot&&Date.parse(e.endAt)>nowMs&&<button type="button" className="radio-v3-delete-slot" onClick={()=>onDeleteSlot(e)} aria-label={'Удалить из сетки: '+(e.playlist?.name||e.title||'Передача')} title="Удалить задание из сетки">Удалить</button>}
   </div>):<p className="p-5 text-center text-sm opacity-65">В выбранном периоде нет передач.</p>}
  </div>}
  <p className="text-xs opacity-65">Автомасштаб подбирает высоту часа под самую короткую передачу (в режиме «День» — только за выбранный день) (максимум 480 пикселей/час). Для очень коротких передач доступно раскрытие карточки ↗. Нажмите на событие, чтобы открыть действия, включая удаление. В виде «Список» есть отдельная кнопка удаления. Будущие события можно переносить; сервер проверяет конфликты. На мобильном используйте режим «День» и меню события. Пустое место в расписании не подтверждает фактический запуск AutoDJ.</p>
 </section>;
}
