import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const card = 'rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-white/5 to-fuchsia-500/5 p-4 sm:p-5 shadow-sm';
const colors = { TODO:'bg-slate-400',IN_PROGRESS:'bg-blue-400',IN_REVIEW:'bg-amber-400',REVISION:'bg-orange-400',APPROVED:'bg-emerald-400',DONE:'bg-teal-400' };
const lane = { TODO:'К выполнению',IN_PROGRESS:'В работе',IN_REVIEW:'На проверке',REVISION:'Доработка',APPROVED:'Принято',DONE:'Готово' };
const completed = new Set(['APPROVED','DONE']);

export function AcademyPulseWidget() {
 const {token}=useAuth();
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;api('/courses/my-learning',{token}).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[token]);
 const courses=data?.courses||[];
 const assignments=data?.assignments||[],practicals=data?.practicals||[];
 const needs=[...assignments.map(a=>({...a,kind:'homework'})),...practicals.map(a=>({...a,kind:'practical'}))]
   .filter(a=>['NOT_SUBMITTED','REJECTED'].includes(a.status)).slice(0,3);
 return <section className={card}>
   <div className="flex justify-between items-center gap-3"><div><p className="text-xs font-semibold tracking-widest text-violet-300 uppercase">Академия</p>
     <h3 className="font-bold text-lg mt-1">Учёба в движении</h3></div><span className="text-3xl" aria-hidden="true">🎓</span></div>
   {error&&<p role="alert" className="text-sm text-rose-300 mt-3">{error}</p>}
   {!data&&!error&&<p className="text-sm opacity-60 mt-3">Загружаем обучение…</p>}
   {data&&<><div className="grid grid-cols-3 gap-2 my-4">
      {[[courses.length,'Курсов'],[assignments.filter(a=>a.status==='APPROVED').length,'Принято ДЗ'],[practicals.filter(a=>a.status==='APPROVED').length,'Практик']].map(([v,label])=>
       <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center"><b className="text-2xl tabular-nums block">{v}</b><span className="text-[11px] opacity-60">{label}</span></div>)}
     </div>
     <p className="text-xs opacity-65 mb-2">Требует внимания</p>
     {needs.length?needs.map(a=><Link key={a.kind+a.id} to={`/app/courses/${encodeURIComponent(a.slug)}?lesson=${a.lessonOrder}&focus=${a.kind}`}
       className="flex justify-between gap-3 text-sm border-t border-white/10 py-2 hover:text-violet-300">
       <span className="min-w-0 break-words">{a.kind==='practical'?'🎯':'📋'} {a.title}</span><span className="text-xs text-amber-300 shrink-0">{a.status==='REJECTED'?'Доработка':'Ожидает'}</span>
     </Link>):<p className="text-sm text-emerald-300 py-2">✓ Все доступные задания в порядке</p>}</>}
   <Link to="/app/academy/me" className="text-sm text-violet-300 hover:underline mt-3 inline-block">Открыть мою Академию →</Link>
 </section>;
}
export function ProductionPulseWidget() {
 const {token}=useAuth();
 const [data,setData]=useState(null),[error,setError]=useState(''),[onlyMine,setOnlyMine]=useState(true);
 const {user}=useAuth();
 useEffect(()=>{let live=true;api('/editorial/workflow/production-board',{token}).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[token]);
 const tasks=(data?.tasks||[]).filter(t=>!onlyMine||t.assigneeId===user?.id);
 const counts=Object.keys(lane).map(key=>({key,count:tasks.filter(t=>t.status===key).length}));
 const total=tasks.length;
 return <section className={card}>
   <div className="flex justify-between gap-3 items-center"><div><p className="text-xs font-semibold tracking-widest uppercase text-violet-300">Редакция</p><h3 className="text-lg font-bold mt-1">Производство</h3></div>
     <button type="button" aria-pressed={onlyMine} className="text-xs rounded-xl border border-violet-400/30 px-3 py-2 hover:bg-violet-400/10"
      onClick={()=>setOnlyMine(v=>!v)}>{onlyMine?'Мои задачи':'Все доступные'}</button></div>
   {error&&<p role="alert" className="text-sm text-rose-300 mt-3">{error}</p>}
   {!data&&!error&&<p className="text-sm opacity-60 mt-3">Загружаем задачи…</p>}
   {data&&<><div className="flex h-3 rounded-full overflow-hidden bg-white/10 gap-0.5 mt-5 mb-4" role="img" aria-label="Распределение задач по статусам">
      {counts.filter(c=>c.count).map(c=><div key={c.key} title={lane[c.key]+': '+c.count} className={colors[c.key]} style={{width:(c.count/Math.max(1,total)*100)+'%'}} />)}
     </div>
     <div className="grid grid-cols-3 gap-2 mb-3">{counts.filter(c=>c.count).slice(0,6).map(c=><div key={c.key} className="rounded-lg bg-white/5 px-2 py-2">
      <div className="text-lg font-bold tabular-nums">{c.count}</div><div className="text-[11px] opacity-65">{lane[c.key]}</div></div>)}</div>
     <div className="text-sm opacity-70">{total?total+' задач на доске':'Задач пока нет'}</div></>}
   <Link to="/app/editorial/production" className="text-violet-300 text-sm inline-block mt-3 hover:underline">Открыть канбан →</Link>
 </section>;
}
export function EditorialCalendarWidget() {
 const {token}=useAuth();
 const [tasks,setTasks]=useState([]),[month,setMonth]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let live=true;api('/editorial/workflow/my-tasks',{token}).then(v=>{if(live)setTasks(v.tasks||[]);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[token]);
 const today=new Date(), first=new Date(today.getFullYear(),today.getMonth()+month,1);
 const year=first.getFullYear(),m=first.getMonth(),days=new Date(year,m+1,0).getDate();
 const offset=(first.getDay()+6)%7;
 const countByDay=useMemo(()=>{const map=new Map();for(const t of tasks){const date=t.workDate||t.dueAt;if(!date)continue;const d=new Date(date);if(d.getFullYear()===year&&d.getMonth()===m){const n=d.getDate();map.set(n,(map.get(n)||0)+1);}}return map;},[tasks,year,m]);
 return <section className={card}>
  <div className="flex items-center justify-between gap-2"><div><p className="text-xs uppercase tracking-widest text-violet-300">Планирование</p><h3 className="font-bold text-lg">Мой календарь</h3></div>
  <div className="flex gap-1"><button aria-label="Предыдущий месяц" className="rounded-lg px-3 py-2 border border-white/15" onClick={()=>setMonth(v=>v-1)}>‹</button>
   <button aria-label="Следующий месяц" className="rounded-lg px-3 py-2 border border-white/15" onClick={()=>setMonth(v=>v+1)}>›</button></div></div>
  <p className="font-medium text-sm mt-3 capitalize">{first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</p>
  <div className="grid grid-cols-7 gap-1 mt-3 text-center">
   {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><div className="text-[11px] opacity-55 py-1" key={d}>{d}</div>)}
   {Array.from({length:offset},(_,i)=><div key={'e'+i}/>)}
   {Array.from({length:days},(_,i)=>{const day=i+1,highlight=year===today.getFullYear()&&m===today.getMonth()&&day===today.getDate();return <div key={day} title={countByDay.get(day)?countByDay.get(day)+' заданий':'Нет заданий'}
    className={`rounded-lg min-h-9 py-1 text-xs flex flex-col justify-center items-center ${highlight?'bg-violet-500/40 ring-1 ring-violet-300':'bg-white/5'}`}>
    {day}{countByDay.has(day)&&<span className="h-1 w-1 rounded-full bg-amber-300 mt-1"/>}</div>;})}
  </div>
  {error&&<p className="text-rose-300 text-xs mt-2">{error}</p>}
  <Link to="/app/editorial/calendar" className="inline-block mt-4 text-violet-300 text-sm hover:underline">Полный календарь →</Link>
 </section>;
}
export function CertificatesShowcaseWidget() {
 const {token}=useAuth();
 const [data,setData]=useState(null);
 useEffect(()=>{let live=true;api('/courses/my-learning',{token}).then(v=>{if(live)setData(v);}).catch(()=>{});return()=>{live=false;};},[token]);
 const awards=data?.certificates||[];
 return <section className={card}>
   <div className="flex items-center gap-3"><span className="text-3xl" aria-hidden="true">🏆</span><div><p className="text-xs text-violet-300 uppercase tracking-widest">Мои достижения</p><h3 className="font-bold text-lg">Сертификаты</h3></div></div>
   <div className="text-4xl font-extrabold mt-5 tabular-nums">{awards.length}</div>
   <p className="text-sm opacity-65">Получено сертификатов</p>
   <div className="space-y-2 mt-4">{awards.slice(0,3).map(c=><Link key={c.id} to={'/app/certificates/'+encodeURIComponent(c.id)}
    className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-sm hover:border-amber-300/60">
     <span aria-hidden="true">✦</span><span className="min-w-0 break-words flex-1">{c.title||c.courseTitle||'Сертификат'}</span><span>↗</span>
    </Link>)}</div>
   {!awards.length&&<p className="text-sm opacity-60 mt-3">Заверши курс, чтобы получить первую награду.</p>}
 </section>;
}
