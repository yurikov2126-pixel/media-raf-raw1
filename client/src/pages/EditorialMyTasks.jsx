import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { STATUS_LABELS, STATUS_ORDER, deadlineState, sortPersonalTasks, taskSummary } from './editorialMyTasksUtils.js';

const STATUS_STYLE = {
    TODO:'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500',
    IN_PROGRESS:'bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700',
    IN_REVIEW:'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
    REVISION:'bg-orange-50 text-orange-950 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700',
    APPROVED:'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700',
    DONE:'bg-teal-50 text-teal-950 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-700',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', year:'numeric' });
function deadlineLabel(task, now) {
    if (!task.dueAt) return 'Без срока';
    const due = new Date(task.dueAt);
    if (Number.isNaN(due.getTime())) return 'Срок не указан';
    const today = new Date(now);
    const dayNumber = (date) => Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) / 86400000;
    const days = dayNumber(due) - dayNumber(today);
    if (deadlineState(task,now) === 'overdue') return days >= 0 ? 'Сегодня · срок истёк' : `Просрочено на ${-days} дн.`;
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return `Срок · ${dateFormat.format(due)}`;
}
export default function EditorialMyTasks() {
    const { token } = useAuth();
    const [params, setParams] = useSearchParams();
    const [tasks,setTasks] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState('');
    const filter = params.get('status') || 'ACTIVE';
    const setFilter = (value) => setParams(value === 'ACTIVE' ? {} : { status:value }, { replace:true });
    const [refreshing,setRefreshing] = useState(false);
    const [now,setNow] = useState(Date.now());
    const sync = useCallback(async (initial = false) => {
        if (!token) return;
        if (!initial) setRefreshing(true);
        try {
            const data = await api('/editorial/workflow/my-tasks', { token });
            setTasks(data.tasks || []);
            setError('');
            setNow(Date.now());
        } catch(e) { setError(e.message || 'Не удалось загрузить задания'); }
        finally { setLoading(false); setRefreshing(false); }
    },[token]);
    useEffect(() => {
        setLoading(true);
        void sync(true);
    },[sync]);
    useEffect(() => {
        if (!token) return undefined;
        const endpoint = (import.meta.env.VITE_API || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
        const socket = io(endpoint, { auth:{token}, reconnection:true });
        const update = () => { void sync(); };
        const visible = () => { if (document.visibilityState === 'visible') update(); };
        socket.on('editorial:workflow:updated', update);
        socket.on('connect', update);
        window.addEventListener('online', update);
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', visible);
        return () => {
            socket.off('editorial:workflow:updated', update);
            socket.off('connect', update);
            socket.disconnect();
            window.removeEventListener('online', update);
            window.removeEventListener('focus', update);
            document.removeEventListener('visibilitychange', visible);
        };
    },[token,sync]);
    const summary = useMemo(() => taskSummary(tasks,now),[tasks,now]);
    const shown = useMemo(() => sortPersonalTasks(tasks.filter(task =>
        filter === 'ACTIVE' ? !['APPROVED','DONE'].includes(task.status)
        : filter === 'ALL' ? true : task.status === filter),now),[tasks,filter,now]);
    return <section className="editorial-my-tasks space-y-4 text-slate-900 dark:text-slate-100" aria-label="Мои задания">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Мои задания</h2><p className="text-sm text-slate-600 dark:text-slate-300">Задания из всех проектов, где вы назначены исполнителем</p></div>
            <button type="button" onClick={() => sync()} disabled={refreshing} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">{refreshing ? 'Обновление…' : 'Обновить'}</button>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Активных',summary.active],['Скоро срок',summary.soon],['Просрочено',summary.overdue],['На доработке',summary.revision]].map(([label,count]) =>
                <div key={label} className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"><strong className="block text-2xl">{count}</strong><span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span></div>)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Фильтр заданий" data-no-route-swipe>
            {[['ACTIVE','Активные'],...STATUS_ORDER.map(status => [status,STATUS_LABELS[status]]),['ALL','Все']].map(([value,label]) =>
                <button key={value} type="button" aria-pressed={filter===value} onClick={() => setFilter(value)}
                    className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${filter===value ? 'border-violet-700 bg-violet-700 text-white dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-800 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'}`}>{label}</button>)}
        </div>
        {error && <div role="alert" className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100">{error} <button type="button" onClick={() => sync()} className="ml-2 font-semibold underline">Повторить</button></div>}
        {loading ? <p role="status" className="p-4 text-sm">Загружаем задания…</p> :
            shown.length === 0 ? <div className="rounded-xl border border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">В этой категории заданий пока нет.</div> :
            <div className="grid gap-3 md:grid-cols-2">
                {shown.map(task => {
                    const deadline = deadlineState(task,now);
                    return <div key={task.id} className="block min-w-0 rounded-xl border border-slate-300 bg-white p-4 shadow-sm transition dark:border-slate-600 dark:bg-slate-800 dark:hover:border-violet-400">
                        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 break-words text-base font-semibold">{task.title}</h3>
                            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLE[task.status] || STATUS_STYLE.TODO}`}>{STATUS_LABELS[task.status] || task.status}</span></div>
                        <p className="mt-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{task.project?.title || 'Проект'}</p>
                        {task.description && <p className="mt-2 line-clamp-2 break-words text-sm text-slate-700 dark:text-slate-200">{task.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-600">
                            <span className={deadline === 'overdue' ? 'font-semibold text-rose-700 dark:text-rose-300' : deadline === 'soon' ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}>
                                {deadlineLabel(task,now)}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">{[['details','Открыть задание'],['materials','Материалы'],['discussion','Обсуждение']].map(([tab,label]) => <Link key={tab} to={`/app/editorial/projects?project=${encodeURIComponent(task.projectId)}&task=${encodeURIComponent(task.id)}&from=my-tasks&status=${encodeURIComponent(filter)}&tab=${tab}`} className="inline-flex min-h-11 items-center rounded-lg border border-violet-300 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-500 dark:text-violet-200 dark:hover:bg-slate-700">{label}</Link>)}</div>
                    </div>;
                })}
            </div>}
    </section>;
}
