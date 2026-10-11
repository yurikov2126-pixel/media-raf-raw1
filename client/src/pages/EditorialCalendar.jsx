import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const taskDate = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const taskLink = task => `/app/editorial/projects?project=${encodeURIComponent(task.projectId)}&task=${encodeURIComponent(task.id)}&tab=details&from=my-tasks`;
const STATUS = { TODO:'К выполнению', IN_PROGRESS:'В работе', IN_REVIEW:'На проверке', REVISION:'На доработке', APPROVED:'Утверждено', DONE:'Завершено' };
export default function EditorialCalendar() {
    const { token } = useAuth();
    const [month,setMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
    const [selected,setSelected] = useState(() => dayKey(new Date()));
    const [tasks,setTasks] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState('');
    const [reload,setReload] = useState(0);
    useEffect(() => {
        let active = true; setLoading(true); setError('');
        api('/editorial/workflow/my-tasks', { token }).then(data => { if (active) setTasks(data.tasks || []); })
            .catch(err => { if (active) { setError(err.message || 'Не удалось загрузить календарь'); setTasks([]); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    },[token,reload]);
    const byDate = useMemo(() => {
        const map = new Map();
        tasks.forEach(task => { const d = taskDate(task.dueAt); if (!d) return; const key = dayKey(d); map.set(key,[...(map.get(key)||[]),task]); });
        return map;
    },[tasks]);
    const first = new Date(month.getFullYear(),month.getMonth(),1);
    const offset = (first.getDay()+6)%7;
    const total = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const cells = [...Array(offset).fill(null), ...Array.from({length:total},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1))];
    while (cells.length % 7) cells.push(null);
    const changeMonth = delta => { const d = new Date(month.getFullYear(),month.getMonth()+delta,1); setMonth(d); setSelected(dayKey(d)); };
    const selectedTasks = (byDate.get(selected)||[]).slice().sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
    const monthCount = tasks.filter(t=>{const d=taskDate(t.dueAt);return d && d.getFullYear()===month.getFullYear() && d.getMonth()===month.getMonth();}).length;
    return <section className="editorial-calendar space-y-4" aria-label="Календарь заданий">
        <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Календарь</h2><p className="text-sm opacity-75">Сроки ваших заданий по дням · в этом месяце: {loading ? '…' : monthCount}</p></div><button className="editorial-calendar-control rounded-xl border px-4 py-2 text-sm font-semibold" type="button" disabled={loading} onClick={()=>setReload(n=>n+1)}>Обновить</button></header>
        {error && <p role="alert" className="rounded-xl border border-rose-400 p-3 text-sm">{error}</p>}
        <div className="editorial-calendar-surface rounded-2xl border p-3 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2"><button type="button" className="editorial-calendar-control min-h-11 rounded-xl border px-4" onClick={()=>changeMonth(-1)} aria-label="Предыдущий месяц">←</button><h3 className="text-center text-base font-semibold capitalize">{monthName.format(month)}</h3><button type="button" className="editorial-calendar-control min-h-11 rounded-xl border px-4" onClick={()=>changeMonth(1)} aria-label="Следующий месяц">→</button></div>
            <div className="editorial-calendar-grid grid grid-cols-7 gap-1 sm:gap-2">{weekdays.map(w=><span key={w} className="py-2 text-center text-xs font-semibold opacity-65">{w}</span>)}{cells.map((d,i)=>d ? <button key={dayKey(d)} type="button" aria-label={`${d.toLocaleDateString('ru-RU')}, заданий: ${(byDate.get(dayKey(d))||[]).length}`} aria-pressed={selected===dayKey(d)} onClick={()=>setSelected(dayKey(d))} className="editorial-calendar-day relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-sm sm:min-h-20"><span className="font-semibold">{d.getDate()}</span>{byDate.has(dayKey(d))&&<span className="editorial-calendar-count rounded-full px-1.5 text-[10px] font-semibold">{byDate.get(dayKey(d)).length}</span>}</button> : <span key={`blank-${i}`} aria-hidden="true"/>)}</div>
        </div>
        <section className="editorial-calendar-surface rounded-2xl border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Задания на {new Date(`${selected}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</h3><button type="button" className="editorial-calendar-control rounded-lg border px-3 py-2 text-xs" onClick={()=>{const today=new Date();setMonth(new Date(today.getFullYear(),today.getMonth(),1));setSelected(dayKey(today));}}>Сегодня</button></div>
            {loading ? <p role="status" className="mt-4 text-sm opacity-70">Загружаем сроки…</p> : selectedTasks.length ? <div className="mt-3 space-y-2">{selectedTasks.map(t=><Link key={t.id} to={taskLink(t)} className="editorial-calendar-item flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><span className="min-w-0"><strong className="block break-words text-sm">{t.title}</strong><span className="text-xs opacity-70">{t.project?.title || 'Проект'} · {STATUS[t.status] || t.status}</span></span><span className="text-xs font-semibold">{taskDate(t.dueAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} ↗</span></Link>)}</div> : <p className="mt-4 text-sm opacity-70">На выбранный день заданий со сроком нет.</p>}
        </section>
    </section>;
}
