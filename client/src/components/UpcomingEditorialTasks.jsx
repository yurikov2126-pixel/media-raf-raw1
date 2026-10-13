import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const labels = {
    TODO: 'К выполнению', IN_PROGRESS: 'В работе', IN_REVIEW: 'На проверке',
    REVISION: 'На доработке', APPROVED: 'Утверждено',
};
const closed = new Set(['DONE', 'APPROVED']);
const taskTime = task => {
    const stamp = task.dueAt || task.workDate;
    if (!stamp) return null;
    const date = new Date(stamp);
    return Number.isNaN(date.valueOf()) ? null : date;
};

export default function UpcomingEditorialTasks() {
    const { token } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        let live = true;
        setLoading(true);
        api('/editorial/workflow/my-tasks', { token })
            .then(data => { if (live) setTasks(data.tasks || []); })
            .catch(e => { if (live) setError(e.message || 'Не удалось загрузить задания'); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [token]);
    const upcoming = useMemo(() => tasks
        .filter(t => !closed.has(t.status))
        .sort((a,b) => (taskTime(a)?.valueOf() ?? Infinity) - (taskTime(b)?.valueOf() ?? Infinity))
        .slice(0,5), [tasks]);
    const now = Date.now();
    return <section className="ui-section" aria-label="Ближайшие редакционные задания">
        <div className="ui-section-head">
            <div>
                <div className="ui-section-title">Ближайшие задания</div>
                <div className="ui-card2__muted">Твои редакционные задачи и важные сроки</div>
            </div>
            <Link className="ui-section-link" to="/app/editorial/my-tasks">Все задания →</Link>
        </div>
        <div className="ui-card2">
            {loading ? <div role="status" className="py-6 text-sm opacity-65">Загружаем задания…</div> :
             error ? <div role="alert" className="py-5 text-sm text-rose-300">{error}</div> :
             !upcoming.length ? <div className="py-6 text-sm opacity-70">Активных назначенных заданий пока нет. Загляни в Редакцию, чтобы узнать о новых проектах.</div> :
             <div className="divide-y divide-white/10">
                {upcoming.map(task => {
                    const deadline = taskTime(task);
                    const late = Boolean(deadline && deadline.valueOf() < now);
                    const url = '/app/editorial/projects?project=' + encodeURIComponent(task.projectId) + '&task=' + encodeURIComponent(task.id) + '&from=my-tasks';
                    return <Link key={task.id} to={url} className="flex flex-wrap sm:flex-nowrap gap-3 items-center py-3 hover:bg-white/5 rounded-lg px-2 -mx-2">
                        <span className="shrink-0 rounded-xl bg-violet/15 text-violet-soft w-10 h-10 grid place-items-center" aria-hidden="true">📋</span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold break-words">{task.title}</span>
                            <span className="block mt-1 text-xs opacity-65 break-words">{task.project?.title || 'Редакционный проект'} · {labels[task.status] || task.status}</span>
                        </span>
                        <span className={`text-xs shrink-0 ${late ? 'text-rose-300 font-semibold' : 'opacity-65'}`}>
                            {deadline ? (late ? 'Просрочено · ' : '') + deadline.toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour: task.dueAt ? '2-digit':undefined, minute:task.dueAt ? '2-digit':undefined }) : 'Без срока'}
                        </span>
                        <span className="text-violet-soft" aria-hidden="true">→</span>
                    </Link>;
                })}
            </div>}
        </div>
    </section>;
}
