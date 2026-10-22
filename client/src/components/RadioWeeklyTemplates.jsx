import {useEffect,useMemo,useState} from 'react';
import {scheduleDayKey,scheduleAddDays} from './RadioScheduleBoard.jsx';
const MOSCOW='Europe/Moscow';
const localParts=date=>new Intl.DateTimeFormat('en-GB',{timeZone:MOSCOW,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date));
export const scheduleTemplateEntry=slot=>{
 const local=new Date(Date.parse(slot.startAt)+3*3600000);
 return {weekday:(local.getUTCDay()+6)%7,minute:local.getUTCHours()*60+local.getUTCMinutes(),durationMinutes:Math.round((Date.parse(slot.endAt)-Date.parse(slot.startAt))/60000),playlistId:slot.playlistId||null,title:slot.title||slot.playlist?.name||'Передача'};
};
const names=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const pad=n=>String(n).padStart(2,'0');
const timeLabel=item=>names[item.weekday]+' '+pad(Math.floor(item.minute/60))+':'+pad(item.minute%60);
const mondayOf=day=>{const time=Date.parse(day+'T12:00:00+03:00');const weekday=new Date(time+3*3600000).getUTCDay();return scheduleAddDays(day,-((weekday+6)%7));};
export default function RadioWeeklyTemplates({slots=[],date,playlists=[],call,refresh,toast}){
 const [open,setOpen]=useState(false),[templates,setTemplates]=useState([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[items,setItems]=useState([]),[target,setTarget]=useState(()=>scheduleAddDays(mondayOf(scheduleDayKey(new Date())),7)),[busy,setBusy]=useState(false);
 const weekStart=mondayOf(date);
 const available=useMemo(()=>slots.filter(slot=>scheduleDayKey(slot.startAt)>=weekStart&&scheduleDayKey(slot.startAt)<scheduleAddDays(weekStart,7)).map(scheduleTemplateEntry).sort((a,b)=>a.weekday-b.weekday||a.minute-b.minute),[slots,weekStart]);
 const load=async()=>{const data=await call('/schedule/templates');setTemplates(data.templates||[]);};
 useEffect(()=>{if(open)load().catch(e=>toast.error(e.message));},[open]);
 const selectTemplate=id=>{setSelected(id);const template=templates.find(t=>t.id===id);setName(template?.name||'');setItems(template?.items||[]);};
 const invoke=async(task,success)=>{if(busy)return;setBusy(true);try{await task();await load();await refresh();toast.success(success);}catch(e){toast.error(e.message||'Ошибка шаблона');}finally{setBusy(false);}};
 const save=()=>invoke(async()=>{const result=await call(selected?'/schedule/templates/'+selected:'/schedule/templates',{method:selected?'PUT':'POST',body:{name,items}});if(!selected)setSelected(result.template.id);},'Шаблон сохранён');
 const remove=()=>{if(!selected||!window.confirm('Удалить шаблон «'+name+'»? Запланированные передачи сохранятся.'))return;invoke(async()=>{await call('/schedule/templates/'+selected,{method:'DELETE'});setSelected('');setName('');setItems([]);},'Шаблон удалён');};
 const apply=()=>{if(!selected)return;const planned=items.length;if(!window.confirm('Добавить '+planned+' передач из шаблона «'+name+'» на неделю с '+target+'? При конфликте изменений не будет.'))return;invoke(()=>call('/schedule/templates/'+selected+'/apply',{method:'POST',body:{weekStart:target}}),'Недельный шаблон применён');};
 return <section className="rounded-2xl border border-current/15 p-3">
  <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>▦ Недельные шаблоны эфира</span><span>{open?'Свернуть ▲':'Открыть редактор ▼'}</span></button>
  {open&&<div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
   <aside className="space-y-2">
    <button type="button" className="radio-v3-schedule-btn w-full" onClick={()=>{setSelected('');setName('');setItems([]);}}>＋ Новый шаблон</button>
    <button type="button" className="radio-v3-schedule-btn w-full" onClick={()=>{setSelected('');setName('Учебная неделя');setItems(available);}}>Создать из текущей недели ({available.length})</button>
    {templates.map(template=><button type="button" key={template.id} onClick={()=>selectTemplate(template.id)} className={'radio-v3-schedule-btn block w-full text-left '+(selected===template.id?'border-violet-500 bg-violet-500/10':'')}>{template.name} <span className="opacity-60">({template.items?.length||0})</span></button>)}
   </aside>
   <div className="min-w-0 space-y-3">
    <label className="block text-xs font-semibold">Название шаблона<input className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3 text-sm" maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Учебная неделя"/></label>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Передачи ({items.length})</strong><button type="button" className="radio-v3-schedule-btn" onClick={()=>setItems(available)}>Заменить передачами текущей недели</button></div>
    <div className="max-h-80 space-y-2 overflow-y-auto">
     {items.map((item,i)=><div key={i} className="grid gap-2 rounded-xl border border-current/15 p-2 sm:grid-cols-[80px_100px_minmax(0,1fr)_80px_auto]">
      <select aria-label={'День передачи '+(i+1)} className="radio-v3-schedule-btn" value={item.weekday} onChange={e=>setItems(old=>old.map((v,j)=>j===i?{...v,weekday:Number(e.target.value)}:v))}>{names.map((day,k)=><option key={day} value={k}>{day}</option>)}</select>
      <input type="time" aria-label={'Время передачи '+(i+1)} className="radio-v3-schedule-btn w-full" value={pad(Math.floor(item.minute/60))+':'+pad(item.minute%60)} onChange={e=>{const [h,m]=e.target.value.split(':').map(Number);setItems(old=>old.map((v,j)=>j===i?{...v,minute:h*60+m}:v));}}/>
      <select aria-label={'Плейлист передачи '+(i+1)} className="radio-v3-schedule-btn min-w-0" value={item.playlistId||''} onChange={e=>setItems(old=>old.map((v,j)=>j===i?{...v,playlistId:e.target.value||null}:v))}><option value="">План без плейлиста</option>{playlists.filter(p=>p.status==='APPROVED').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input type="number" min={1} max={720} disabled={!!item.playlistId} aria-label={'Длительность в минутах '+(i+1)} className="radio-v3-schedule-btn w-full" value={item.durationMinutes} onChange={e=>setItems(old=>old.map((v,j)=>j===i?{...v,durationMinutes:Number(e.target.value)}:v))}/>
      <button type="button" className="radio-v3-schedule-btn" aria-label={'Удалить строку '+(i+1)} onClick={()=>setItems(old=>old.filter((_,j)=>j!==i))}>✕</button>
      {!item.playlistId&&<input className="radio-v3-schedule-btn sm:col-span-5 w-full" maxLength={120} aria-label={'Название плановой передачи '+(i+1)} placeholder="Название передачи" value={item.title} onChange={e=>setItems(old=>old.map((v,j)=>j===i?{...v,title:e.target.value}:v))}/>}
     </div>)}
     {!items.length&&<p className="text-xs opacity-70">Пока нет передач. Добавьте строку или возьмите расписание текущей недели.</p>}
    </div>
    <button type="button" className="radio-v3-schedule-btn" disabled={items.length>=100} onClick={()=>setItems(old=>[...old,{weekday:0,minute:9*60,durationMinutes:30,playlistId:null,title:'Новая передача'}])}>＋ Добавить передачу</button>
    <div className="flex flex-wrap gap-2">
     <button type="button" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={busy||!name.trim()||!items.length} onClick={save}>Сохранить шаблон</button>
     <button type="button" className="radio-v3-schedule-btn text-rose-600" disabled={busy||!selected} onClick={remove}>Удалить шаблон</button>
    </div>
    {selected&&<div className="space-y-2 rounded-xl border border-violet-500/30 p-3">
     <strong className="text-sm">Применить шаблон к неделе</strong>
     <label className="flex flex-wrap items-center gap-2 text-xs">Понедельник <input type="date" className="radio-v3-schedule-btn" value={target} onChange={e=>setTarget(e.target.value)}/></label>
     <p className="text-xs opacity-70">Записи будут созданы только если вся неделя свободна. Активный эфир не изменяется.</p>
     <button type="button" className="radio-v3-schedule-btn" disabled={busy} onClick={apply}>Применить к расписанию</button>
    </div>}
   </div>
  </div>}
 </section>;
}
