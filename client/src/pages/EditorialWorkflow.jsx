import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const LABELS = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', IN_REVIEW: 'На проверке', REVISION: 'Доработка', APPROVED: 'Утверждено', DONE: 'Завершено' };
export default function EditorialWorkflow({ project, onError }) {
    const { token, user } = useAuth();
    const [stages, setStages] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [stageTitle, setStageTitle] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskStage, setTaskStage] = useState('');
    const [taskAssignee, setTaskAssignee] = useState('');
    const [taskDue, setTaskDue] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const canEdit = user?.role === 'ADMIN' || project.members.some((m) => m.userId === user?.id && ['MANAGER', 'EDITOR'].includes(m.role));
    const canView = canEdit || project.members.some((m) => m.userId === user?.id);
    useEffect(() => {
        let active = true;
        setLoading(true); setStages([]); setTasks([]);
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
            if (kind === 'stage') {
                await api(`/editorial/workflow/projects/${project.id}/stages`, { method: 'POST', token, body: { title: stageTitle } });
                setStageTitle('');
            } else {
                await api(`/editorial/workflow/projects/${project.id}/tasks`, { method: 'POST', token, body: { title: taskTitle, stageId: taskStage || null, assigneeId: taskAssignee || null, dueAt: taskDue ? new Date(taskDue).toISOString() : null } });
                setTaskTitle(''); setTaskDue('');
            }
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
        <h4 className="font-semibold">Этапы и задания</h4>
        {canEdit && <div className="grid gap-3 md:grid-cols-2">
            <form onSubmit={(e) => submit(e, 'stage')} className="rounded-xl border border-current/15 p-3 space-y-2">
                <label className="block text-sm">Новый этап<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" maxLength={100} required value={stageTitle} onChange={(e) => setStageTitle(e.target.value)} /></label>
                <button disabled={busy} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">Добавить этап</button>
            </form>
            <form onSubmit={(e) => submit(e, 'task')} className="rounded-xl border border-current/15 p-3 space-y-2">
                <label className="block text-sm">Новая задача<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" maxLength={160} required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /></label>
                <label className="block text-sm">Этап<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskStage} onChange={(e) => setTaskStage(e.target.value)}><option value="">Без этапа</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
                <label className="block text-sm">Исполнитель<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}><option value="">Не назначен</option>{project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user?.fullName || m.userId}</option>)}</select></label>
                <label className="block text-sm">Срок<input type="datetime-local" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></label>
                <button disabled={busy} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">Создать задачу</button>
            </form>
        </div>}
        {loading ? <p role="status">Загружаем задачи…</p> : tasks.length === 0 ? <p className="text-sm opacity-60">Пока нет заданий.</p> : (
            <div className="space-y-3">{[...stages, { id: null, title: 'Без этапа' }].map((stage) => {
                const list = tasks.filter((task) => task.stageId === stage.id);
                if (!list.length) return null;
                return <div key={stage.id || 'none'} className="rounded-xl border border-current/15 p-3 space-y-2">
                    <h5 className="font-medium">{stage.title}</h5>
                    {list.map((task) => {
                        const canChange = canEdit || task.assigneeId === user?.id;
                        return <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 py-2">
                            <div className="min-w-0"><div className="text-sm font-medium break-words">{task.title}</div><div className="text-xs opacity-60">{task.assignee?.fullName || 'Не назначен'}{task.dueAt ? ' · ' + new Date(task.dueAt).toLocaleString('ru-RU') : ''}</div></div>
                            {canChange ? <select aria-label={`Статус задачи: ${task.title}`} value={task.status} onChange={(e) => setStatus(task, e.target.value)} className="rounded-lg border border-current/20 bg-transparent p-2 text-xs">
                                {Object.entries(LABELS).filter(([key]) => canEdit || ['IN_PROGRESS', 'IN_REVIEW', 'REVISION'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select> : <span className="text-xs opacity-60">{LABELS[task.status] || task.status}</span>}
                        </div>;
                    })}
                </div>;
            })}</div>
        )}
    </section>;
}
