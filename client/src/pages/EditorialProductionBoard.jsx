import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const LANES = [
    ['TODO', 'К выполнению', 'slate'],
    ['IN_PROGRESS', 'В работе', 'blue'],
    ['IN_REVIEW', 'На проверке', 'amber'],
    ['REVISION', 'На доработке', 'orange'],
    ['APPROVED', 'Утверждено', 'emerald'],
    ['DONE', 'Завершено', 'teal'],
];
const NEXT = {
    TODO: ['IN_PROGRESS'],
    IN_PROGRESS: ['TODO'],
    REVISION: ['IN_PROGRESS'],
    APPROVED: ['DONE'],
    DONE: ['IN_PROGRESS'],
};
const laneStyles = {
    slate: 'border-slate-400/35 bg-slate-400/10',
    blue: 'border-blue-400/40 bg-blue-400/10',
    amber: 'border-amber-400/40 bg-amber-400/10',
    orange: 'border-orange-400/40 bg-orange-400/10',
    emerald: 'border-emerald-400/40 bg-emerald-400/10',
    teal: 'border-teal-400/40 bg-teal-400/10',
};
const active = status => !['APPROVED','DONE'].includes(status);

export default function EditorialProductionBoard() {
    const { token, user } = useAuth();
    const [data, setData] = useState({ projects: [], tasks: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [projectId, setProjectId] = useState('all');
    const [search, setSearch] = useState('');
    const [mine, setMine] = useState(false);
    const [moving, setMoving] = useState('');
    const [draggedId, setDraggedId] = useState(null);
    const [over, setOver] = useState('');
    const load = async () => {
        const result = await api('/editorial/workflow/production-board', { token });
        setData(result);
    };
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api('/editorial/workflow/production-board', { token })
            .then(result => { if (!cancelled) setData(result); })
            .catch(err => { if (!cancelled) setError(err.message || 'Не удалось загрузить доску'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token]);
    const projectMap = useMemo(() => new Map(data.projects.map(p => [p.id, p])), [data.projects]);
    const visible = useMemo(() => data.tasks.filter(task => {
        if (projectId !== 'all' && task.projectId !== projectId) return false;
        if (mine && task.assigneeId !== user?.id) return false;
        const q = search.trim().toLocaleLowerCase('ru');
        return !q || [task.title, task.assignee?.fullName, projectMap.get(task.projectId)?.title]
            .some(text => String(text || '').toLocaleLowerCase('ru').includes(q));
    }), [data.tasks, projectId, mine, search, user?.id, projectMap]);
    const canMove = (task, status) => {
        if (!NEXT[task.status]?.includes(status)) return false;
        const editor = projectMap.get(task.projectId)?.canEdit;
        return editor || (task.assigneeId === user?.id && status === 'IN_PROGRESS');
    };
    const move = async (task, status) => {
        if (!canMove(task, status) || moving) return;
        const before = data.tasks;
        setMoving(task.id); setError('');
        setData(d => ({ ...d, tasks: d.tasks.map(x => x.id === task.id ? { ...x, status } : x) }));
        try {
            const result = await api('/editorial/workflow/production-board/tasks/' + encodeURIComponent(task.id) + '/move', {
                method: 'PATCH', token, body: { status },
            });
            setData(d => ({ ...d, tasks: d.tasks.map(x => x.id === task.id ? { ...x, ...result.task } : x) }));
        } catch (e) {
            setData(d => ({ ...d, tasks: before }));
            setError(e.message || 'Не удалось переместить задачу');
            try { await load(); } catch {}
        } finally { setMoving(''); setDraggedId(null); setOver(''); }
    };
    const getTaskUrl = task => '/app/editorial/projects?project=' + encodeURIComponent(task.projectId)
        + '&task=' + encodeURIComponent(task.id) + '&tab=details';
    const dragEnd = () => { setDraggedId(null); setOver(''); };
    const overdue = task => task.dueAt && active(task.status) && new Date(task.dueAt).getTime() < Date.now();
    const soon = task => task.dueAt && active(task.status)
        && new Date(task.dueAt).getTime() >= Date.now() && new Date(task.dueAt).getTime() < Date.now()+7*864e5;
    return <section className="space-y-5 min-w-0" aria-label="План производства — канбан">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-2xl font-bold">Производство</h2>
                <p className="text-sm opacity-65 mt-1">Общая CRM-доска редакционных заданий, от постановки до завершения</p>
            </div>
            <Link to="/app/editorial/projects" className="rounded-xl border border-violet-400/40 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400/10">Проекты →</Link>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
                [visible.length, 'Всего задач'],
                [visible.filter(t => t.status === 'IN_PROGRESS').length, 'В работе'],
                [visible.filter(t => t.status === 'IN_REVIEW').length, 'На проверке'],
                [visible.filter(overdue).length, 'Просрочено'],
            ].map(([n,label]) => <div key={label} className="rounded-xl border border-current/10 bg-white/5 p-3">
                <div className="text-xl font-bold tabular-nums">{n}</div>
                <div className="text-xs opacity-65">{label}</div>
            </div>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center rounded-xl border border-current/10 p-3 bg-white/5">
            <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">Проект</span>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full max-w-60 rounded-lg border border-current/20 bg-transparent p-2 text-sm">
                    <option value="all">Все проекты</option>
                    {data.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
            </label>
            <input type="search" aria-label="Поиск задач" placeholder="Поиск задач и исполнителей…" value={search}
                onChange={e => setSearch(e.target.value)} className="min-w-40 flex-1 rounded-lg border border-current/20 bg-transparent p-2 text-sm"/>
            <label className="inline-flex gap-2 items-center p-2 text-sm"><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/> Только мои</label>
        </div>
        {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
            {error} <button type="button" className="underline ml-2" onClick={() => { setError('');load().catch(e=>setError(e.message)); }}>Повторить</button>
        </div>}
        {loading ? <p role="status" className="p-5 opacity-65">Загружаем производственную доску…</p> :
        <div className="overflow-x-auto overscroll-x-contain pb-5" data-no-route-swipe>
            <div className="flex gap-3 min-w-max items-start">
                {LANES.map(([status,title,tone]) => {
                    const tasks = visible.filter(t=>t.status===status);
                    const dropTask = data.tasks.find(t=>t.id===draggedId);
                    const droppable = dropTask && canMove(dropTask,status);
                    return <section key={status} aria-label={title}
                        onDragOver={e=>{ if (droppable) { e.preventDefault();e.dataTransfer.dropEffect='move';setOver(status); } }}
                        onDragLeave={()=>{if(over===status)setOver('');}}
                        onDrop={e=>{e.preventDefault();if(droppable)void move(dropTask,status);}}
                        className={`w-[280px] sm:w-[310px] shrink-0 rounded-2xl border p-3 min-h-64 transition-colors ${laneStyles[tone]} ${over===status?'ring-2 ring-violet-400':''}`}>
                        <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <h3 className="font-bold text-sm">{title}</h3>
                            <span className="rounded-full bg-black/10 dark:bg-white/10 px-2.5 py-1 text-xs tabular-nums">{tasks.length}</span>
                        </div>
                        <div className="space-y-2">
                            {tasks.map(task=><article key={task.id} draggable={!moving && !!projectMap.get(task.projectId)?.canEdit}
                                onDragStart={e=>{setDraggedId(task.id);e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';}}
                                onDragEnd={dragEnd}
                                className={`rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm p-3 space-y-3 dark:border-slate-600 dark:bg-[#171728] dark:text-slate-100 ${moving===task.id?'opacity-50':''} ${draggedId===task.id?'ring-2 ring-violet-400':''}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <Link to={getTaskUrl(task)} className="text-sm font-semibold leading-snug break-words hover:underline">{task.title}</Link>
                                    {projectMap.get(task.projectId)?.canEdit && <span className="opacity-40 text-lg select-none cursor-grab" aria-hidden="true">⠿</span>}
                                </div>
                                <p className="text-xs opacity-65 break-words">{projectMap.get(task.projectId)?.title}</p>
                                <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    {task.assignee?.fullName && <span className="rounded-md bg-violet-500/10 px-2 py-1">👤 {task.assignee.fullName}</span>}
                                    {task.dueAt && <span className={`rounded-md px-2 py-1 ${overdue(task)?'bg-rose-500/15 text-rose-600 dark:text-rose-300':soon(task)?'bg-amber-500/15':'bg-slate-500/10'}`}>🕒 {new Date(task.dueAt).toLocaleDateString('ru-RU')}</span>}
                                    {task._count?.materialFiles>0 && <span className="rounded-md bg-slate-500/10 px-2 py-1">📎 {task._count.materialFiles}</span>}
                                    {task._count?.comments>0 && <span className="rounded-md bg-slate-500/10 px-2 py-1">💬 {task._count.comments}</span>}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <Link className="text-xs text-violet-700 dark:text-violet-300 underline" to={getTaskUrl(task)}>Открыть карточку</Link>
                                    {NEXT[task.status]?.length > 0 && <select aria-label={'Переместить задачу: '+task.title} value=""
                                        disabled={moving===task.id}
                                        onChange={e=>{if(e.target.value)void move(task,e.target.value);}}
                                        className="max-w-36 rounded-lg border border-current/20 bg-transparent text-xs px-2 py-1.5">
                                        <option value="">Переместить…</option>
                                        {NEXT[task.status].filter(next=>canMove(task,next)).map(next=>
                                            <option key={next} value={next}>{LANES.find(l=>l[0]===next)?.[1]}</option>)}
                                    </select>}
                                </div>
                            </article>)}
                            {!tasks.length && <p className="rounded-xl border border-dashed border-current/15 p-5 text-center text-xs opacity-60">Нет задач</p>}
                        </div>
                    </section>;
                })}
            </div>
        </div>}
        <p className="text-xs opacity-60">Перетаскивайте карточки мышью на ПК. На телефоне используйте «Переместить…». Отправка материалов на проверку и утверждение выполняются из карточки задания — без обхода согласования.</p>
    </section>;
}
