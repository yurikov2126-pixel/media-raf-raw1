import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const fullDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const statusLabels = { TODO:'К выполнению', IN_PROGRESS:'В работе', IN_REVIEW:'На проверке', REVISION:'На доработке', APPROVED:'Утверждено', DONE:'Завершено' };
const key = (date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
const parsed = (value) => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const today = () => new Date();
export default function EditorialCalendar() {
    const { token } = useAuth();
    const [month, setMonth] = useState(() => new Date(today().getFullYear(), today().getMonth(), 1));
    const [selected, setSelected] = useState(() => key(today()));
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true);
        api('/editorial/workflow/my-tasks', { token })
            .then(data => { if (active) { setTasks(data.tasks || []); setError(''); } })
            .catch(err => { if (active) { setTasks([]); setError(err.message || 'Не удалось загрузить задания'); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, refresh]);
    const events = useMemo(() => tasks.map(task => ({ ...task, date: parsed(task.dueAt) }))
        .filter(task => task.date && (filter === 'ALL' || (filter === 'ACTIVE' ? !['DONE','APPROVED'].includes(task.status) : task.status === filter))), [tasks, filter]);
    const byDate = useMemo(() => {
        const grouped = new Map();
        events.forEach(task => { const k = key(task.date); grouped.set(k, [...(grouped.get(k) || []), task]); });
        return grouped;
    }, [events]);
    const first = new Date(month.getFullYear(),month.getMonth(),1);
    const offset = (first.getDay()+6)%7;
    const totalDays = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const cells = Array.from({length: Math.ceil((offset+totalDays)/7)*7},(_,i) => {
        const date = new Date(month.getFullYear(),month.getMonth(),i-offset+1);
        return { date, k:key(date), current:date.getMonth()===month.getMonth() };
    });
    const selectedEvents = (byDate.get(selected) || []).slice().sort((a,b) => a.date-b.date);
    const shiftMonth = (step) => {
        const next = new Date(month.getFullYear(),month.getMonth()+step,1);
        setMonth(next);
        setSelected(key(next));
    };
    const goToday = () => { const d = today(); setMonth(new Date(d.getFullYear(),d.getMonth(),1)); setSelected(key(d)); };
    return <section className="editorial-calendar space-y-4" aria-label="Календарь редакции">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Календарь</h2><p className="mt-1 text-sm opacity-75">Сроки ваших заданий по дням</p></div>
            <div className="flex flex-wrap gap-2">
                <button type="button" className="editorial-calendar-control" onClick={goToday}>Сегодня</button>
                <button type="button" className="editorial-calendar-control" onClick={() => setRefresh(v => v+1)} disabled={loading}>Обновить</button>
            </div>
        </header>
        {error && <p role="alert" className="rounded-xl border border-rose-400 p-3 text-sm">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><button type="button" className="editorial-calendar-control" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">‹</button>
                <h3 className="min-w-40 text-center font-semibold capitalize" aria-live="polite">{monthTitle.format(month)}</h3>
                <button type="button" className="editorial-calendar-control" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">›</button></div>
            <label className="text-sm">Показать <select className="editorial-calendar-control ml-2" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="ALL">Все задания</option><option value="ACTIVE">Незавершённые</option><option value="IN_REVIEW">На проверке</option><option value="REVISION">На доработке</option>
            </select></label>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,340px)]">
            <div className="editorial-calendar-panel min-w-0 rounded-2xl border p-2 sm:p-4" aria-busy={loading}>
                <div className="grid grid-cols-7 gap-1">{weekdays.map(d => <div key={d} className="py-2 text-center text-xs font-semibold opacity-70">{d}</div>)}
                    {cells.map(({date,k,current}) => {
                        const count = (byDate.get(k) || []).length;
                        return <button type="button" key={k} onClick={() => setSelected(k)} aria-label={`${fullDate.format(date)}: ${count} заданий`} aria-pressed={selected===k} className={`editorial-calendar-day relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl p-1 text-sm sm:min-h-20 ${current ? '' : 'opacity-35'} ${selected===k ? 'is-selected' : ''} ${k===key(today()) ? 'is-today' : ''}`}>
                            <span className="font-semibold">{date.getDate()}</span>{count>0 && <span className="editorial-calendar-count text-[10px] font-bold">{count}</span>}
                        </button>;
                    })}
                </div>
            </div>
            <aside className="editorial-calendar-panel min-w-0 rounded-2xl border p-4" aria-live="polite">
                <h3 className="font-semibold capitalize">{fullDate.format(new Date(selected+'T12:00:00'))}</h3>
                <p className="mt-1 text-sm opacity-70">{loading ? 'Загрузка…' : `Заданий: ${selectedEvents.length}`}</p>
                {!loading && selectedEvents.length===0 && <p className="mt-5 text-sm opacity-70">На выбранную дату заданий нет.</p>}
                <div className="mt-4 space-y-2">{selectedEvents.map(task => <Link key={task.id} to={`/app/editorial/projects?project=${encodeURIComponent(task.projectId)}&task=${encodeURIComponent(task.id)}&tab=details&from=my-tasks`} className="editorial-calendar-event block min-w-0 rounded-xl border p-3">
                    <strong className="block break-words text-sm">{task.title}</strong>
                    <span className="mt-1 block text-xs opacity-75">{time.format(task.date)} · {statusLabels[task.status] || task.status}</span>
                    <span className="mt-1 block truncate text-xs opacity-70">{task.project?.title || 'Проект'}</span>
                </Link>)}</div>
            </aside>
        </div>
        <p className="text-xs opacity-65">Показаны сроки заданий, назначенных вам. Это не календарь публикаций и не расписание всей команды.</p>
    </section>;
}
