import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function EditorialReviewInbox() {
    const { token } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [projectFilter, setProjectFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [deadlineFilter, setDeadlineFilter] = useState('ALL');
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;
        setLoading(true);
        api('/editorial/workflow/review-inbox', { token })
            .then(data => { if (active) { setTasks(data.tasks || []); setError(''); } })
            .catch(err => { if (active) setError(err.message || 'Не удалось загрузить очередь'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, refresh]);

    const projects = useMemo(() => [...new Map(tasks.map(task => [task.projectId, task.project])).values()]
        .filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'ru')), [tasks]);
    const now = Date.now();
    const shown = tasks.filter(task => {
        if (projectFilter !== 'ALL' && task.projectId !== projectFilter) return false;
        const due = task.dueAt ? new Date(task.dueAt).getTime() : Infinity;
        if (deadlineFilter === 'OVERDUE' && !(due < now)) return false;
        if (deadlineFilter === 'SOON' && !(due >= now && due <= now + 7 * 86400000)) return false;
        const text = [task.title, task.project?.title, task.assignee?.fullName].join(' ').toLocaleLowerCase('ru');
        return text.includes(search.trim().toLocaleLowerCase('ru'));
    });

    return <section className="editorial-review-inbox editorial-workspace-content space-y-4 text-slate-900 dark:text-slate-100" aria-label="Единая очередь проверки">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">На проверке</h2><p className="text-sm opacity-70">Материалы из проектов, в которых вы можете согласовывать задания</p></div>
            <button type="button" onClick={() => setRefresh(value => value + 1)} className="min-h-11 rounded-lg border border-current/20 px-4 py-2 text-sm">Обновить</button>
        </header>
        {error && <p role="alert" className="rounded-lg border border-rose-400 p-3 text-sm">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm">Поиск<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Задание или исполнитель" className="mt-1 block w-full rounded-lg border border-current/20 bg-transparent p-2" /></label>
            <label className="text-sm">Проект<select value={projectFilter} onChange={event => setProjectFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-current/20 bg-transparent p-2"><option value="ALL">Все проекты</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            <label className="text-sm">Срок<select value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-current/20 bg-transparent p-2"><option value="ALL">Любой</option><option value="OVERDUE">Просрочено</option><option value="SOON">Ближайшие 7 дней</option></select></label>
        </div>
        <p className="text-sm opacity-70">Найдено: {shown.length}</p>
        {loading ? <p role="status">Загружаем материалы…</p> : shown.length === 0 ? <p className="rounded-xl border border-current/15 p-5 text-sm opacity-70">{tasks.length ? 'По выбранным фильтрам ничего нет.' : 'Все материалы проверены. Новых работ пока нет.'}</p> :
            <div className="space-y-2">{shown.map(task => {
                const due = task.dueAt ? new Date(task.dueAt) : null;
                const valid = due && !Number.isNaN(due.getTime());
                const overdue = valid && due.getTime() < now;
                return <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/15 bg-white/60 p-4 dark:bg-slate-800/60">
                    <div className="min-w-0 flex-1 space-y-1"><h3 className="break-words font-semibold">{task.title}</h3><p className="text-xs opacity-75">{task.project?.title || 'Проект'} · {task.assignee?.fullName || 'Исполнитель не назначен'}</p><p className={`text-xs ${overdue ? 'font-semibold text-rose-700 dark:text-rose-300' : 'opacity-75'}`}>{valid ? `${overdue ? 'Просрочено' : 'Срок'}: ${due.toLocaleString('ru-RU')}` : 'Без срока'}</p></div>
                    <Link className="inline-flex min-h-11 items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white" to={`/app/editorial/projects?project=${encodeURIComponent(task.projectId)}&task=${encodeURIComponent(task.id)}&tab=materials&from=reviews`}>Проверить материалы →</Link>
                </article>;
            })}</div>}
    </section>;
}
