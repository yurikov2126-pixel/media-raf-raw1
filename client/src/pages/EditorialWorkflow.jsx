import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import EditorialTaskDetails from './EditorialTaskDetails.jsx';

const STATUS_COLORS = {
    TODO: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100',
    IN_PROGRESS: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200',
    IN_REVIEW: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200',
    REVISION: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-400 dark:bg-orange-950 dark:text-orange-200',
    APPROVED: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200',
    DONE: 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200',
};
const LABELS = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', IN_REVIEW: 'На проверке', REVISION: 'Доработка', APPROVED: 'Утверждено', DONE: 'Завершено' };
export default function EditorialWorkflow({ project, onError, linkedTaskId = null }) {
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
    const [view, setView] = useState('list');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('recent');
    const [deadlineFilter, setDeadlineFilter] = useState('ALL');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const closeButtonRef = useRef(null);
    const openedLinkRef = useRef(null);
    const dialogRef = useRef(null);
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
    useEffect(() => {
        if (!loading && linkedTaskId && openedLinkRef.current !== linkedTaskId && tasks.some((task) => task.id === linkedTaskId)) { openedLinkRef.current = linkedTaskId; setSelectedTaskId(linkedTaskId); }
    }, [loading, linkedTaskId, tasks]);
    useEffect(() => {
        if (!selectedTaskId) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setSelectedTaskId(null);
            if (event.key === 'Tab' && dialogRef.current) {
                const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
                if (!controls.length) return;
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [selectedTaskId]);
    async function refresh() {
        const data = await api(`/editorial/workflow/projects/${project.id}/workflow`, { token });
        setStages(data.stages); setTasks(data.tasks);
    }
    async function submit(event) {
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
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const isFinished = (task) => task.status === 'DONE';
    const isOverdue = (task) => !isFinished(task) && task.dueAt && new Date(task.dueAt).getTime() < now;
    const isDueSoon = (task) => !isFinished(task) && task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() <= now + 7 * dayMs;
    const myTasksCount = tasks.filter((task) => task.assigneeId === user?.id && !isFinished(task)).length;
    const overdueCount = tasks.filter(isOverdue).length;
    const dueSoonCount = tasks.filter(isDueSoon).length;
    const visibleTasks = tasks.filter((task) => {
        if (deadlineFilter === 'OVERDUE' && !isOverdue(task)) return false;
        if (deadlineFilter === 'SOON' && !isDueSoon(task)) return false;
        if (deadlineFilter === 'NO_DUE' && task.dueAt) return false;
        if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
        if (assigneeFilter === 'MINE' && task.assigneeId !== user?.id) return false;
        if (assigneeFilter === 'UNASSIGNED' && task.assigneeId) return false;
        const haystack = `${task.title} ${task.description || ''} ${task.assignee?.fullName || ''}`.toLocaleLowerCase('ru');
        return haystack.includes(query.trim().toLocaleLowerCase('ru'));
    }).sort((a, b) => {
        if (sortBy === 'due') return (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity);
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'ru');
        return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    });
    if (!canView) return <p className="text-sm opacity-70">Задачи доступны только участникам проекта.</p>;
    return <section className="space-y-4">
        <div className="grid grid-cols-3 gap-2" aria-label="Сводка задач">
            <div className="rounded-xl border border-violet-300/25 bg-violet-400/10 p-3"><p className="text-[11px] opacity-65">Всего задач</p><p className="text-2xl font-bold tabular-nums">{tasks.length}</p></div>
            <div className="rounded-xl border border-blue-300/25 bg-blue-400/10 p-3"><p className="text-[11px] opacity-65">В работе</p><p className="text-2xl font-bold tabular-nums">{tasks.filter((task) => task.status === 'IN_PROGRESS').length}</p></div>
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3"><p className="text-[11px] opacity-65">Готово</p><p className="text-2xl font-bold tabular-nums">{tasks.filter((task) => task.status === 'DONE').length}</p></div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm" aria-label="Быстрые фильтры задач">
            <button type="button" onClick={() => { setAssigneeFilter('MINE'); setDeadlineFilter('ALL'); }} aria-pressed={assigneeFilter === 'MINE' && deadlineFilter === 'ALL'} className="rounded-lg px-2 py-1 text-violet-700 hover:bg-violet-400/10 dark:text-violet-200">Мои активные · <strong>{myTasksCount}</strong></button>
            <button type="button" onClick={() => { setDeadlineFilter('OVERDUE'); setAssigneeFilter('ALL'); }} aria-pressed={deadlineFilter === 'OVERDUE'} className="rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-400/10 dark:text-rose-300">Просрочено · <strong>{overdueCount}</strong></button>
            <button type="button" onClick={() => { setDeadlineFilter('SOON'); setAssigneeFilter('ALL'); }} aria-pressed={deadlineFilter === 'SOON'} className="rounded-lg px-2 py-1 text-amber-800 hover:bg-amber-400/10 dark:text-amber-200">7 дней · <strong>{dueSoonCount}</strong></button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Задания <span className="text-xs font-normal opacity-50">· {tasks.length}</span></h4>{canEdit && <div className="flex gap-2"><button type="button" onClick={() => setComposer((v) => v === 'task' ? null : 'task')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 dark:bg-violet-200 dark:text-slate-950 dark:hover:bg-violet-100">+ Задача</button></div>}</div>
        {canEdit && composer && <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-slate-600 dark:bg-slate-800/70">
            {composer === 'task' && <form onSubmit={submit} className="space-y-3">
                <label className="block text-sm">Новая задача<input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" maxLength={160} required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /></label>
                <label className="block text-sm">Исполнитель<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}><option value="">Не назначен</option>{project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user?.fullName || m.userId}</option>)}</select></label>
                <label className="block text-sm">Родительская задача<select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskParent} onChange={(e) => setTaskParent(e.target.value)}><option value="">Нет (основная задача)</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
                <label className="block text-sm">Срок<input type="datetime-local" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskOpen} onChange={(e) => setTaskOpen(e.target.checked)} />Открыть приём заявок</label>
                <button disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 dark:bg-violet-200 dark:text-slate-950 dark:hover:bg-violet-100 disabled:opacity-50">Создать задачу</button>
            </form>}
        </div>}
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowFilters((open) => !open)} aria-expanded={showFilters} aria-controls="editorial-task-filters" className="inline-flex items-center gap-2 rounded-xl border border-violet-300/50 bg-white/40 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100/60 dark:border-slate-500 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-700">
                <span aria-hidden="true">☷</span> Фильтры и вид {(query || statusFilter !== 'ALL' || assigneeFilter !== 'ALL' || deadlineFilter !== 'ALL' || sortBy !== 'recent' || view !== 'list') ? '•' : ''} <span aria-hidden="true">{showFilters ? '⌃' : '⌄'}</span>
            </button>
            {(query || statusFilter !== 'ALL' || assigneeFilter !== 'ALL' || deadlineFilter !== 'ALL' || sortBy !== 'recent' || view !== 'list') && <button type="button" onClick={() => { setQuery(''); setStatusFilter('ALL'); setAssigneeFilter('ALL'); setDeadlineFilter('ALL'); setSortBy('recent'); setView('list'); }} className="text-xs text-violet-700 underline dark:text-violet-200">Сбросить</button>}
        </div>
        {showFilters && <div id="editorial-task-filters" className="space-y-3 rounded-xl border border-current/10 bg-white/30 p-3 dark:bg-slate-800/30">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Поиск и фильтры заданий">
            <label className="block"><span className="sr-only">Поиск заданий</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск заданий…" className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm" /></label>
            <label className="block"><span className="sr-only">Фильтр по статусу</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"><option value="ALL">Все статусы</option>{Object.entries(LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block"><span className="sr-only">Фильтр по исполнителю</span><select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"><option value="ALL">Все исполнители</option><option value="MINE">Мои задания</option><option value="UNASSIGNED">Без исполнителя</option></select></label>
            <label className="block"><span className="sr-only">Фильтр по сроку</span><select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"><option value="ALL">Все сроки</option><option value="OVERDUE">Просрочено</option><option value="SOON">Ближайшие 7 дней</option><option value="NO_DUE">Без срока</option></select></label>
            <label className="block"><span className="sr-only">Сортировка заданий</span><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"><option value="recent">Сначала новые</option><option value="due">По сроку</option><option value="title">По названию</option></select></label>
        </div>
        <div className="flex items-center justify-between gap-2"><p className="text-xs opacity-60">Показано {visibleTasks.length} из {tasks.length}</p><button type="button" onClick={() => { setQuery(''); setStatusFilter('ALL'); setAssigneeFilter('ALL'); setDeadlineFilter('ALL'); setSortBy('recent'); }} className="text-xs font-medium text-violet-700 underline dark:text-violet-200">Сбросить всё</button></div>
        <div className="flex gap-2 text-xs"><button type="button" onClick={() => setView('board')} aria-pressed={view === 'board'} className={`rounded-lg px-3 py-1.5 ${view === "board" ? "bg-violet-600 text-white dark:bg-violet-200 dark:text-slate-950" : "border border-violet-300 text-violet-700 dark:border-slate-500 dark:text-slate-100"}`}>По статусам</button><button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} className={`rounded-lg px-3 py-1.5 ${view === "list" ? "bg-violet-600 text-white dark:bg-violet-200 dark:text-slate-950" : "border border-violet-300 text-violet-700 dark:border-slate-500 dark:text-slate-100"}`}>Список</button></div>
        </div>}
        {loading ? <p role="status">Загружаем задачи…</p> : visibleTasks.length === 0 ? <p className="rounded-xl border border-current/15 p-4 text-sm opacity-60">{tasks.length === 0 ? 'Пока нет заданий.' : 'Нет заданий по выбранным фильтрам.'}</p> : (
            <div className={view === 'board' ? "grid min-w-0 gap-3 xl:grid-cols-2" : "space-y-2"}>{(view === 'board' ? Object.entries(LABELS).map(([id, title]) => ({ id, title })) : [{ id: 'all', title: 'Все задания' }]).map((stage) => {
                const list = stage.id === 'all' ? visibleTasks : visibleTasks.filter((task) => task.status === stage.id);
                if (!list.length) return null;
                return <div key={stage.id || 'none'} className={view === "board" ? `editorial-glass__status min-w-0 rounded-xl border p-3 space-y-2 ${STATUS_COLORS[stage.id] || "border-slate-300 dark:border-slate-600"}` : "min-w-0 space-y-2"}>
                    {view === "board" && <h5 className="text-sm font-semibold">{stage.title} <span className="font-normal opacity-50">· {list.length}</span></h5>}
                    {list.map((task) => {
                        const canChange = canEdit || task.assigneeId === user?.id;
                        return <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/10 bg-white/35 px-3 py-3 dark:bg-slate-800/35">
                            <div className="min-w-0 flex-1"><button type="button" onClick={() => setSelectedTaskId(task.id)} className="text-left text-sm font-medium underline-offset-2 hover:underline break-words">{task.title}</button><div className="text-xs opacity-60">{task.assignee?.fullName || 'Не назначен'}{task.dueAt ? ' · ' + new Date(task.dueAt).toLocaleString('ru-RU') : ''}{isOverdue(task) ? ' · Просрочено' : isDueSoon(task) ? ' · Скоро срок' : ''}</div></div>
                            {canChange ? <select aria-label={`Статус задачи: ${task.title}`} value={task.status} onChange={(e) => setStatus(task, e.target.value)} className={`rounded-lg border p-2 text-xs font-medium ${STATUS_COLORS[task.status] || ""}`}>
                                {Object.entries(LABELS).filter(([key]) => canEdit || key === task.status || ['IN_PROGRESS', 'IN_REVIEW', 'REVISION'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select> : <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${STATUS_COLORS[task.status] || ""}`}>{LABELS[task.status] || task.status}</span>}
                        </div>;
                    })}
                </div>;
            })}</div>
        )}
        {selectedTaskId && tasks.some((task) => task.id === selectedTaskId) && createPortal(<div className="fixed inset-0 z-[9999] flex min-h-0 items-stretch justify-center bg-slate-950/65 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTaskId(null); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="editorial-task-dialog-title" className="editorial-glass__dialog relative flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100 sm:h-auto sm:max-h-[min(88dvh,850px)] sm:max-w-3xl sm:rounded-2xl">
                <div className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] dark:border-slate-700 dark:bg-slate-900 sm:gap-3 sm:px-5">
                    <div className="min-w-0"><p className="text-xs text-violet-700 dark:text-violet-200">Задание · {project.title}</p><h4 id="editorial-task-dialog-title" className="truncate text-base font-semibold">{tasks.find((task) => task.id === selectedTaskId)?.title}</h4></div>
                    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/app/editorial/projects?project=${encodeURIComponent(project.id)}&task=${encodeURIComponent(selectedTaskId)}`); } catch { onError('Не удалось скопировать ссылку на задание'); } }} className="ml-auto shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800 sm:px-3 sm:text-sm">Ссылка</button>
                    <button type="button" ref={closeButtonRef} onClick={() => setSelectedTaskId(null)} aria-label="Закрыть карточку задания" className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-slate-600 dark:hover:bg-slate-800 sm:px-3 sm:text-sm"><span className="sm:hidden">✕</span><span className="hidden sm:inline">Закрыть</span></button>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:p-5" data-no-route-swipe>
                    <EditorialTaskDetails task={tasks.find((task) => task.id === selectedTaskId)} tasks={tasks} stages={stages} project={project} token={token} user={user} canEdit={canEdit} refresh={refresh} onError={onError} onClose={() => setSelectedTaskId(null)} />
                </div>
                <div className="sticky bottom-0 z-30 shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-900 sm:hidden"><button type="button" onClick={() => setSelectedTaskId(null)} className="w-full rounded-xl border border-current/20 px-4 py-3 text-sm font-semibold">Закрыть задание</button></div>
            </div>
        </div>, document.body)}
    </section>;
}
