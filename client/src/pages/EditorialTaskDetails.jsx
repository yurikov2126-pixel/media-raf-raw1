import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import EditorialTaskDiscussion from './EditorialTaskDiscussion.jsx';
import EditorialMaterials from './EditorialMaterials.jsx';

const STATUSES = [
    ['TODO', 'К выполнению'], ['IN_PROGRESS', 'В работе'], ['IN_REVIEW', 'На проверке'],
    ['REVISION', 'На доработке'], ['APPROVED', 'Утверждено'], ['DONE', 'Завершено'],
];

export default function EditorialTaskDetails({ task, tasks, stages, project, token, user, canEdit, refresh, onError, onClose }) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
    const [parentId, setParentId] = useState(task.parentId || '');
    const [dueAt, setDueAt] = useState(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
    const [dependencyId, setDependencyId] = useState('');
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState(task.status === 'IN_REVIEW' ? 'materials' : 'details');
    useEffect(() => {
        setTitle(task.title); setDescription(task.description || '');
        setAssigneeId(task.assigneeId || '');
        setParentId(task.parentId || '');
        setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
    }, [task]);
    const base = `/editorial/workflow/projects/${project.id}/tasks/${task.id}`;
    const descendants = new Set([task.id]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of tasks) {
            if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
                descendants.add(item.id); changed = true;
            }
        }
    }
    const dependencies = task.dependencies?.map((d) => d.dependsOnId) || [];
    const availableParents = tasks.filter((item) => !descendants.has(item.id));
    const availableDependencies = tasks.filter((item) => item.id !== task.id && !dependencies.includes(item.id));
    const children = tasks.filter((item) => item.parentId === task.id);
    const canChangeStatus = canEdit || task.assigneeId === user?.id;

    async function run(action) {
        if (saving) return;
        setSaving(true); onError('');
        try { await action(); await refresh(); }
        catch (e) { onError(e.message); }
        finally { setSaving(false); }
    }
    function save(event) {
        event.preventDefault();
        run(() => api(base, { method: 'PATCH', token, body: {
            title: title.trim(), description, assigneeId: assigneeId || null,
            parentId: parentId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        } }));
    }
    return <section className="min-w-0 space-y-4" aria-label={`Карточка задачи ${task.title}`}>
        <div className="flex min-w-0 flex-wrap gap-2 border-b border-current/10 pb-3" role="tablist" aria-label="Содержимое задания">
            <button type="button" role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'details' ? 'bg-violet-600 text-white dark:bg-violet-200 dark:text-slate-950' : 'border border-current/15'}`}>Детали</button>
            <button type="button" role="tab" aria-selected={tab === 'materials'} onClick={() => setTab('materials')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'materials' ? 'bg-violet-600 text-white dark:bg-violet-200 dark:text-slate-950' : 'border border-current/15'}`}>Материалы</button>
            <button type="button" role="tab" aria-selected={tab === 'discussion'} onClick={() => setTab('discussion')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'discussion' ? 'bg-violet-600 text-white dark:bg-violet-200 dark:text-slate-950' : 'border border-current/15'}`}>Обсуждение и заявки</button>
        </div>
        {task.status === 'IN_REVIEW' && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/50 dark:text-amber-100">⏳ На проверке — {canEdit ? 'ожидает вашего решения во вкладке «Материалы»' : 'ожидает решения редактора'}</div>}
        <div hidden={tab !== 'details'} className="space-y-4">
        <form onSubmit={save} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm sm:col-span-2">Название
                <input required maxLength={160} disabled={!canEdit || saving} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-current/20 bg-white/40 p-2 text-sm dark:bg-slate-800/40 disabled:opacity-60" />
            </label>
            <label className="block text-sm md:col-span-2">Описание
                <textarea maxLength={10000} rows={3} disabled={!canEdit || saving} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2 disabled:opacity-60" />
            </label>
            <label className="block min-w-0 text-sm">Исполнитель
                <select disabled={!canEdit || saving} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2 disabled:opacity-60">
                    <option value="">Не назначен</option>{project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user?.fullName || m.userId}</option>)}
                </select>
            </label>
            <label className="block text-sm">Срок
                <input type="datetime-local" disabled={!canEdit || saving} value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2 disabled:opacity-60" />
            </label>
            <label className="block text-sm">Родительская задача
                <select disabled={!canEdit || saving} value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2 disabled:opacity-60">
                    <option value="">Нет</option>{availableParents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
            </label>
            {canEdit && <button disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2 dark:bg-violet-200 dark:text-slate-950">Сохранить изменения</button>}
        </form>
        <div className="space-y-2">
            <h6 className="font-medium">Статус</h6>
            {canChangeStatus ? <select disabled={saving} value={task.status} onChange={(e) => run(() => api(base, { method: 'PATCH', token, body: { status: e.target.value } }))} className="w-full min-w-0 max-w-full rounded-lg border border-current/20 bg-white/40 p-2 text-sm dark:bg-slate-800/40">
                {STATUSES.filter(([value]) => canEdit || value === task.status || ['IN_PROGRESS', 'IN_REVIEW', 'REVISION'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select> : <p className="text-sm opacity-70">{STATUSES.find(([value]) => value === task.status)?.[1] || task.status}</p>}
        </div>
        <div className="space-y-2">
            <h6 className="font-medium">Подзадачи ({children.length})</h6>
            {children.length ? children.map((item) => <p key={item.id} className="break-words rounded-lg border border-current/10 p-2 text-sm">{item.title}</p>) : <p className="text-sm opacity-60">Подзадач нет. Для создания выберите эту задачу как родительскую в другой карточке.</p>}
        </div>
        <div className="space-y-2">
            <h6 className="font-medium">Зависит от ({dependencies.length})</h6>
            {dependencies.map((id) => <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-current/10 p-2 text-sm">
                <span className="min-w-0 break-words">{tasks.find((item) => item.id === id)?.title || 'Задача недоступна'}</span>
                {canEdit && <button type="button" disabled={saving} onClick={() => run(() => api(base + '/dependencies/' + encodeURIComponent(id), { method: 'DELETE', token }))} className="shrink-0 rounded-lg border border-current/20 px-2 py-1">Убрать</button>}
            </div>)}
            {canEdit && <div className="flex flex-wrap gap-2">
                <select aria-label="Добавить зависимость" value={dependencyId} onChange={(e) => setDependencyId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent p-2 text-sm">
                    <option value="">Выберите задачу</option>{availableDependencies.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <button type="button" disabled={!dependencyId || saving} onClick={() => run(async () => { await api(base + '/dependencies', { method: 'POST', token, body: { dependsOnId: dependencyId } }); setDependencyId(''); })} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">Добавить</button>
            </div>}
        </div>
        </div>
        <div hidden={tab !== "materials"}><EditorialMaterials project={project} task={task} token={token} user={user} canEdit={canEdit} refresh={refresh} onError={onError} onClose={onClose} /></div>
        <div hidden={tab !== "discussion"}><EditorialTaskDiscussion projectId={project.id} task={task} token={token} userId={user?.id} canEdit={canEdit} onError={onError} onChanged={refresh} /></div>
    </section>;
}
