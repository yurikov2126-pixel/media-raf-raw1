import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import EditorialTaskDetails from './EditorialTaskDetails.jsx';

const LABELS = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', IN_REVIEW: 'На проверке', REVISION: 'Доработка', APPROVED: 'Утверждено', DONE: 'Завершено' };
export default function EditorialWorkflow({ project, onError }) {
    const { token, user } = useAuth();
    const [stages, setStages] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskAssignee, setTaskAssignee] = useState('');
    const [taskParent, setTaskParent] = useState('');
    const [taskOpen, setTaskOpen] = useState(false);
    const [taskDue, setTaskDue] = useState('');
    const [busy, setBusy] = useState(false);
    const [composer, setComposer] = useState(null);
    const [view, setView] = useState('board');
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [loading, setLoading] = useState(true);
    const canEdit = user?.role === 'ADMIN' || project.members.some((m) => m.userId === user?.id && ['MANAGER', 'EDITOR'].includes(m.role));
    const canView = canEdit || project.members.some((m) => m.userId === user?.id);
    useEffect(() => {
        let active = true;
        setLoading(true); setStages([]); setTasks([]); setSelectedTaskId(null);
        if (canView) api(`/editorial/workflow/projects/${project.id}/workflow`, { token })
            .then((data) => { if (active) { setStages(data.stages); setTasks(data.tasks); } })
            .catch((e) => { if (active) onError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        else setLoading(false);
        return () => { active = false; };
    }, [project.id, token, canView]);
    async function refresh() {
        const data = await api(`/editorial/workflow/projects/${project.id}/workflow`, { token });
        setStages(data.stages); setTasks(data.tasks);
    }
    async function submit(event, kind) {
        event.preventDefault(); setBusy(true); onError('');
        try {
                await api(`/editorial/workflow/projects/${project.id}/tasks`, { method: 'POST', token, body: { title: taskTitle, assigneeId: taskAssignee || null, parentId: taskParent || null, isOpen: taskOpen, dueAt: taskDue ? new Date(taskDue).toISOString() : null } });
                setTaskTitle(''); setTaskDue(''); setTaskParent(''); setTaskOpen(false); setComposer(null);
            await refresh();
        } catch (e) { onError(e.message); }
        finally { setBusy(false); }
    }
    async function setStatus(task, status) {
        onError('');
        try {
            await api(`/editorial/workflow/projects/${project.id}/tasks/${task.id}`, { method: 'PATCH', token, body: { status } });
            await refresh();
        } catch (e) { onError(e.message); }
    }
    if (!canView) return <p className="text-sm opacity-70">Задачи доступны только участникам проекта.</p>;
    return <section className="space-y-4 border-t border-current/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Задания <span className="text-xs font-normal opacity-50">· {tasks.length}</span></h4>{canEdit && <div className="flex gap-2"><button type="button" onClick={() => setComposer((v) => v === 'task' ? null : 'task')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700">+ Задача</button></div>}</div>
        {canEdit && composer && <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-400/20 dark:bg-violet-400/5">
            {composer === 'task' && <form onSubmit={(e) => submit(e, 'task')} className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 space-y-2 dark:border-violet-400/20 dark:bg-violet-400/5">
                <label className="block text-sm">Новая задача<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" maxLength={160} required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /></label>
                <label className="block text-sm">Исполнитель<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}><option value="">Не назначен</option>{project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user?.fullName || m.userId}</option>)}</select></label>
                <label className="block text-sm">Родительская задача<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskParent} onChange={(e) => setTaskParent(e.target.value)}><option value="">Нет (основная задача)</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
                <label className="block text-sm">Срок<input type="datetime-local" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskOpen} onChange={(e) => setTaskOpen(e.target.checked)} />Открыть приём заявок</label>
                <button disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Создать задачу</button>
            </form>}
        </div>}
        <div className="flex gap-2 text-xs"><button type="button" onClick={() => setView('board')} aria-pressed={view === 'board'} className={`rounded-lg px-3 py-1.5 ${view === "board" ? "bg-violet-600 text-white" : "border border-violet-300 text-violet-700 dark:text-violet-300"}`}>По статусам</button><button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} className={`rounded-lg px-3 py-1.5 ${view === "list" ? "bg-violet-600 text-white" : "border border-violet-300 text-violet-700 dark:text-violet-300"}`}>Список</button></div>
        {loading ? <p role="status">Загружаем задачи…</p> : tasks.length === 0 ? <p className="text-sm opacity-60">Пока нет заданий.</p> : (
            <div className={view === 'board' ? "grid min-w-0 gap-3 xl:grid-cols-2" : "space-y-2"}>{(view === 'board' ? Object.entries(LABELS).map(([id, title]) => ({ id, title })) : [{ id: 'all', title: 'Все задания' }]).map((stage) => {
                const list = stage.id === 'all' ? tasks : tasks.filter((task) => task.status === stage.id);
                if (!list.length) return null;
                return <div key={stage.id || 'none'} className="rounded-xl border border-current/15 p-3 space-y-2">
                    <h5 className="text-sm font-semibold text-violet-700 dark:text-violet-300">{stage.title} <span className="font-normal opacity-50">· {list.length}</span></h5>
                    {list.map((task) => {
                        const canChange = canEdit || task.assigneeId === user?.id;
                        return <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 py-2">
                            <div className="min-w-0"><button type="button" onClick={() => setSelectedTaskId(task.id)} className="text-left text-sm font-medium underline-offset-2 hover:underline break-words">{task.title}</button><div className="text-xs opacity-60">{task.assignee?.fullName || 'Не назначен'}{task.dueAt ? ' · ' + new Date(task.dueAt).toLocaleString('ru-RU') : ''}</div></div>
                            {canChange ? <select aria-label={`Статус задачи: ${task.title}`} value={task.status} onChange={(e) => setStatus(task, e.target.value)} className="rounded-lg border border-current/20 bg-transparent p-2 text-xs">
                                {Object.entries(LABELS).filter(([key]) => canEdit || key === task.status || ['IN_PROGRESS', 'IN_REVIEW', 'REVISION'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select> : <span className="text-xs opacity-60">{LABELS[task.status] || task.status}</span>}
                        </div>;
                    })}
                </div>;
            })}</div>
        )}
        {selectedTaskId && tasks.some((task) => task.id === selectedTaskId) && <EditorialTaskDetails task={tasks.find((task) => task.id === selectedTaskId)} tasks={tasks} stages={stages} project={project} token={token} user={user} canEdit={canEdit} refresh={refresh} onError={onError} onClose={() => setSelectedTaskId(null)} />}
    </section>;
}
