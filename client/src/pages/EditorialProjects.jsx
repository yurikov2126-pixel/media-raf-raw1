import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import EditorialWorkflow from './EditorialWorkflow.jsx';

export default function EditorialProjects() {
    const { token, user } = useAuth();
    const [searchParams] = useSearchParams();
    const linkedProjectId = searchParams.get('project');
    const linkedTaskId = searchParams.get('task');
    const fromMyTasks = searchParams.get('from') === 'my-tasks';
    const returnStatus = searchParams.get('status');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState('CLOSED');
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [projectTab, setProjectTab] = useState('tasks');
    const [projectQuery, setProjectQuery] = useState('');
    const [showMemberForm, setShowMemberForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [memberId, setMemberId] = useState('');
    const [personQuery, setPersonQuery] = useState('');
    const [people, setPeople] = useState([]);
    const [searching, setSearching] = useState(false);
    const [memberRole, setMemberRole] = useState('PARTICIPANT');
    const [savingMember, setSavingMember] = useState(false);
    const canCreate = ['ADMIN', 'MENTOR'].includes(user?.role);
    useEffect(() => {
        let active = true;
        if (personQuery.trim().length < 2) { setPeople([]); return () => { active = false; }; }
        const timeout = setTimeout(() => {
            setSearching(true);
            api('/editorial/workflow/people?q=' + encodeURIComponent(personQuery.trim()), { token })
                .then((data) => { if (active) setPeople(data.people || []); })
                .catch((e) => { if (active) setError(e.message); })
                .finally(() => { if (active) setSearching(false); });
        }, 300);
        return () => { active = false; clearTimeout(timeout); };
    }, [personQuery, token]);

    async function reload() {
        const result = await api('/editorial/projects', { token });
        setProjects(result.projects);
        setSelected((current) => current ? result.projects.find((p) => p.id === current.id) || null : null);
    }
    useEffect(() => {
        let active = true;
        api('/editorial/projects', { token })
            .then((result) => { if (active) { setProjects(result.projects); if (linkedProjectId) setSelected(result.projects.find((p) => p.id === linkedProjectId) || null); } })
            .catch((e) => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token, linkedProjectId]);

    async function create(event) {
        event.preventDefault();
        if (creating) return;
        setCreating(true); setError('');
        try {
            const result = await api('/editorial/projects', { token, method: 'POST', body: { title, description, visibility } });
            setTitle(''); setDescription(''); setSelected(result.project); setShowCreate(false); setProjectTab('tasks');
            await reload();
        } catch (e) { setError(e.message); }
        finally { setCreating(false); }
    }

    async function addMember(event) {
        event.preventDefault();
        if (!selected || savingMember) return;
        setSavingMember(true); setError('');
        try {
            await api(`/editorial/projects/${selected.id}/members`, { token, method: 'POST', body: { userId: memberId.trim(), role: memberRole } });
            setMemberId(''); setPersonQuery(''); setPeople([]);
            await reload();
        } catch (e) { setError(e.message); }
        finally { setSavingMember(false); }
    }

    const filteredProjects = projects.filter((project) => `${project.title} ${project.description || ''}`.toLocaleLowerCase('ru').includes(projectQuery.trim().toLocaleLowerCase('ru')));
    const canManage = selected && (user?.role === 'ADMIN' || selected.members.some((m) => m.userId === user?.id && m.role === 'MANAGER'));

    return (
        <div className="editorial-glass__projects space-y-4">
            {fromMyTasks && <Link to={"/app/editorial/my-tasks" + (returnStatus ? "?status=" + encodeURIComponent(returnStatus) : "")} className="inline-flex min-h-11 items-center rounded-lg border border-violet-400 px-3 py-2 text-sm font-semibold text-violet-800 dark:text-violet-200">← Вернуться к моим заданиям</Link>}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-semibold">Проекты</h2><p className="text-xs opacity-60">{projects.length} доступно · управление редакционными задачами</p></div>
                {canCreate && <button type="button" onClick={() => setShowCreate((v) => !v)} aria-expanded={showCreate} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 dark:bg-violet-200 dark:text-slate-950 dark:hover:bg-violet-100">{showCreate ? 'Отмена' : '+ Новый проект'}</button>}
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
            {showCreate && canCreate && <form onSubmit={create} className="editorial-glass__surface space-y-3 rounded-2xl border border-current/15 p-4">
                <h3 className="font-semibold">Создать проект</h3>
                <label className="block text-sm">Название<input autoFocus required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" /></label>
                <label className="block text-sm">Описание<textarea rows={2} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" /></label>
                <label className="block text-sm">Видимость<select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2"><option value="CLOSED">Закрытый — по приглашению</option><option value="TEAM">Командный — виден участникам сайта</option></select></label>
                <button disabled={creating} className="rounded-lg border border-current/30 px-4 py-2 text-sm font-semibold disabled:opacity-50">{creating ? 'Создание…' : 'Создать'}</button>
            </form>}
            <div className="min-w-0 space-y-3">
                <aside className={`min-w-0 space-y-2 ${selected ? "hidden" : ""}`} aria-label="Список проектов">
                    {!loading && projects.length > 0 && <label className="block"><span className="sr-only">Поиск проектов</span><input type="search" value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Найти проект…" className="w-full rounded-xl border border-current/15 bg-transparent px-3 py-3 text-sm" /></label>}
                    {loading ? <p role="status" className="p-3 text-sm">Загружаем…</p> : projects.length === 0 ? <p className="rounded-xl border border-current/15 p-4 text-sm opacity-70">Проектов пока нет.</p> : filteredProjects.length === 0 ? <p className="p-3 text-sm opacity-60">По вашему запросу проектов нет.</p> : filteredProjects.map((project) => (
                        <button type="button" key={project.id} onClick={() => { setSelected(project); setProjectTab('tasks'); setShowMemberForm(false); }}
                            aria-current={selected?.id === project.id ? 'true' : undefined}
                            className={`block w-full min-w-0 rounded-xl border p-3 text-left transition-colors ${selected?.id === project.id ? 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-300 dark:bg-slate-700 dark:text-white' : 'border-violet-200/60 hover:border-violet-400 dark:border-slate-600'}`}>
                            <strong className="block truncate text-sm">{project.title}</strong>
                            <span className="mt-1 block text-xs opacity-60">{project.visibility === 'CLOSED' ? 'Закрытый' : 'Командный'} · {project.members.length} участн.</span>
                        </button>
                    ))}
                </aside>
                <main className={`min-w-0 ${selected ? "" : "hidden"}`}>
                    {!selected ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 p-6 text-center text-sm opacity-60">Выберите проект из списка, чтобы открыть рабочее пространство.</div> : (
                        <section className="editorial-glass__surface min-w-0 space-y-4 rounded-2xl border border-violet-200/60 p-3 sm:p-5" aria-label={`Проект ${selected.title}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0"><h3 className="break-words text-lg font-semibold">{selected.title}</h3>{selected.description && <p className="mt-1 line-clamp-2 break-words text-xs opacity-60">{selected.description}</p>}</div>

                            </div>
                            <div className="flex gap-2 border-b border-current/10 pb-2" role="tablist" aria-label="Раздел проекта">
                                <button type="button" role="tab" aria-selected={projectTab === 'tasks'} onClick={() => setProjectTab('tasks')} className={`rounded-lg px-3 py-2 text-sm ${projectTab === 'tasks' ? 'bg-violet-600 text-white font-semibold dark:bg-violet-200 dark:text-slate-950' : 'text-violet-700 opacity-75 dark:text-slate-100'}`}>Задания</button>
                                <button type="button" role="tab" aria-selected={projectTab === 'team'} onClick={() => setProjectTab('team')} className={`rounded-lg px-3 py-2 text-sm ${projectTab === 'team' ? 'bg-violet-600 text-white font-semibold dark:bg-violet-200 dark:text-slate-950' : 'opacity-65'}`}>Команда · {selected.members.length}</button>
                            </div>
                            {projectTab === 'tasks' ? <EditorialWorkflow key={selected.id} project={selected} onError={setError} linkedTaskId={selected.id === linkedProjectId ? linkedTaskId : null} /> : <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Участники</h4>{canManage && <button type="button" onClick={() => setShowMemberForm((v) => !v)} className="rounded-lg border border-current/20 px-3 py-2 text-xs">{showMemberForm ? 'Скрыть форму' : '+ Участник'}</button>}</div>
                                {selected.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 py-2 text-sm"><span className="min-w-0 break-words">{member.user?.fullName || member.userId} <span className="opacity-50">@{member.user?.username}</span></span><span className="text-xs opacity-60">{({ MANAGER: 'Руководитель', EDITOR: 'Редактор', PARTICIPANT: 'Участник', OBSERVER: 'Наблюдатель' })[member.role] || member.role}</span></div>)}
                                {canManage && showMemberForm && <form onSubmit={addMember} className="space-y-3 rounded-xl border border-current/10 p-3">
                                    <label className="block text-sm">Найти участника<input value={personQuery} onChange={(e) => { setPersonQuery(e.target.value); setMemberId(''); }} placeholder="Имя или логин" autoComplete="off" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" /></label>
                                    {searching && <p className="text-xs opacity-60">Поиск…</p>}
                                    {people.length > 0 && <div className="max-h-44 overflow-auto rounded-lg border border-current/15 p-1">{people.map((person) => <button type="button" key={person.id} onClick={() => { setMemberId(person.id); setPersonQuery(person.fullName + ' (@' + person.username + ')'); setPeople([]); }} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-current/10">{person.fullName} <span className="opacity-60">@{person.username}</span></button>)}</div>}
                                    <label className="block text-sm">Роль<select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2"><option value="PARTICIPANT">Участник</option><option value="EDITOR">Редактор</option><option value="OBSERVER">Наблюдатель</option><option value="MANAGER">Руководитель</option></select></label>
                                    <button disabled={!memberId || savingMember} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">{savingMember ? 'Сохранение…' : 'Добавить участника'}</button>
                                </form>}
                            </div>}
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}
