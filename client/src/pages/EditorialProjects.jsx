import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import EditorialWorkflow from './EditorialWorkflow.jsx';
import EditorialProjectOperations from './EditorialProjectOperations.jsx';

const CREW_POSITIONS = {
    LEAD_PHOTO: 'Основной фотограф',
    ADDITIONAL_PHOTO: 'Дополнительный фотограф',
    LEAD_VIDEO: 'Основной видеорепортёр',
    GIMBAL: 'Оператор стабилизатора',
    ACTION_CAMERA: 'Оператор экшн-камеры',
    SOUND_ENGINEER: 'Звукорежиссёр',
    INTERVIEWER: 'Интервьюер',
    VIDEO_EDITOR: 'Монтажёр',
    EDITOR_IN_CHIEF: 'Главный редактор',
    PHOTO_EDITOR: 'Фоторедактор',
    REPORTER: 'Корреспондент',
    DESIGNER: 'Дизайнер',
    PRODUCER: 'Продюсер',
    CURATOR: 'Куратор редакции',
};
const crewName = value => CREW_POSITIONS[value] || 'Участник команды';
const DEADLINE_POSITIONS = new Set(['LEAD_PHOTO', 'ADDITIONAL_PHOTO', 'LEAD_VIDEO', 'VIDEO_EDITOR', 'PHOTO_EDITOR']);

export default function EditorialProjects() {
    const { token, user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const linkedProjectId = searchParams.get('project');
    const linkedTaskId = searchParams.get('task');
    const fromMyTasks = searchParams.get('from') === 'my-tasks';
    const fromReviews = searchParams.get('from') === 'reviews';
    const returnStatus = searchParams.get('status');
    const linkedTab = ['details','materials','discussion'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'details';
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventEndDate, setEventEndDate] = useState('');
    const [projectDuration, setProjectDuration] = useState('single');
    const [wizardTaskDay, setWizardTaskDay] = useState('');
    const [visibility, setVisibility] = useState('CLOSED');
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardProject, setWizardProject] = useState(null);
    const [wizardMembers, setWizardMembers] = useState([]);
    const [wizardTasks, setWizardTasks] = useState([]);
    const [wizardTaskTitle, setWizardTaskTitle] = useState('');
    const [wizardTaskDescription,setWizardTaskDescription]=useState('');
    const [wizardTaskLocation, setWizardTaskLocation] = useState('');
    const [wizardTaskAssignee, setWizardTaskAssignee] = useState('');
    const [wizardTaskDue, setWizardTaskDue] = useState('');
    const [wizardBusy, setWizardBusy] = useState(false);
    const selectedWizardMember = wizardMembers.find(m => m.userId === wizardTaskAssignee);
    const wizardDeadlineAllowed = Boolean(selectedWizardMember && DEADLINE_POSITIONS.has(selectedWizardMember.crewPosition));
    const [projectTab, setProjectTab] = useState('tasks');
    const [projectQuery, setProjectQuery] = useState('');
    const [showMemberForm, setShowMemberForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [memberId, setMemberId] = useState('');
    const [personQuery, setPersonQuery] = useState('');
    const [people, setPeople] = useState([]);
    const [searching, setSearching] = useState(false);
    const [crewPosition, setCrewPosition] = useState('');
    const [crewSavingId, setCrewSavingId] = useState(null);
    const [savingMember, setSavingMember] = useState(false);
    const [memberRole,setMemberRole]=useState('PARTICIPANT');
    const [editingTitle,setEditingTitle]=useState(false);
    const [titleDraft,setTitleDraft]=useState('');
    const [savingTitle,setSavingTitle]=useState(false);
    const [editingBrief,setEditingBrief]=useState(false);
    const [briefDraft,setBriefDraft]=useState('');
    const [savingBrief,setSavingBrief]=useState(false);
    const [roleSavingId,setRoleSavingId]=useState(null);
    const [updatingCompletion, setUpdatingCompletion] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [editingProjectDates,setEditingProjectDates] = useState(false);
    const [projectStartDraft,setProjectStartDraft] = useState('');
    const [projectEndDraft,setProjectEndDraft] = useState('');
    const [savingProjectDates,setSavingProjectDates] = useState(false);
    const [projectEditorOpen, setProjectEditorOpen] = useState(false);
    const [savingProjectEditor, setSavingProjectEditor] = useState(false);
    const openProjectEditor = () => { if (!selected) return; setTitleDraft(selected.title || ''); setBriefDraft(selected.description || ''); setProjectStartDraft(selected.eventDate?.slice(0,10) || ''); setProjectEndDraft(selected.eventEndDate?.slice(0,10) || ''); setProjectEditorOpen(true); setError(''); };
    const editProjectDates=()=>{setProjectStartDraft(selected.eventDate?.slice(0,10)||'');setProjectEndDraft(selected.eventEndDate?.slice(0,10)||'');setEditingProjectDates(true)};
    const saveProjectDates=async(e)=>{e.preventDefault();if(!selected||!projectStartDraft||(projectEndDraft&&projectEndDraft<projectStartDraft))return;setSavingProjectDates(true);setError('');try{await api('/editorial/projects/'+selected.id,{method:'PATCH',token,body:{eventDate:projectStartDraft,eventEndDate:projectEndDraft||null}});await reload();setEditingProjectDates(false)}catch(err){setError(err.message)}finally{setSavingProjectDates(false)}};
    async function saveProjectEditor(event) {
        event.preventDefault();
        if (!selected || savingProjectEditor || !titleDraft.trim() || titleDraft.trim().length > 120 || briefDraft.length > 5000 || !projectStartDraft || (projectEndDraft && projectEndDraft < projectStartDraft)) return;
        setSavingProjectEditor(true); setError('');
        try { await api(`/editorial/projects/${selected.id}`, { token, method: 'PATCH', body: { title: titleDraft.trim(), description: briefDraft, eventDate: projectStartDraft, eventEndDate: projectEndDraft || null } }); await reload(); setProjectEditorOpen(false); }
        catch (e) { setError(e.message); } finally { setSavingProjectEditor(false); }
    }
    const [canCreate, setCanCreate] = useState(false);
    useEffect(() => {
        let active = true;
        setCanCreate(false);
        if (token) api('/editorial/workflow/navigation', { token })
            .then((data) => { if (active) setCanCreate(Boolean(data.canCreateProjects)); })
            .catch(() => { if (active) setCanCreate(false); });
        return () => { active = false; };
    }, [token, user?.role]);
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

    function startWizard() {
        setTitle(''); setDescription(''); setEventDate(''); setEventEndDate(''); setProjectDuration('single'); setWizardTaskDay(''); setVisibility('CLOSED');
        setWizardStep(1); setWizardProject(null); setWizardMembers([]); setWizardTasks([]);
        setWizardTaskTitle(''); setWizardTaskDescription(''); setWizardTaskLocation(''); setWizardTaskAssignee(''); setWizardTaskDue('');
        setMemberId(''); setCrewPosition(''); setPersonQuery(''); setPeople([]); setError(''); setShowCreate(true);
    }
    function finishWizard() {
        setShowCreate(false);
        setSelected(wizardProject);
        setProjectTab('tasks');
        void reload();
    }
    async function addWizardMember(event) {
        event.preventDefault();
        if (!wizardProject || !memberId || wizardBusy) return;
        setWizardBusy(true); setError('');
        try {
            await api(`/editorial/projects/${wizardProject.id}/members`, { token, method: 'POST', body: { userId: memberId, role: 'PARTICIPANT', crewPosition: crewPosition || null } });
            const result = await api('/editorial/projects', { token });
            const project = result.projects.find(p => p.id === wizardProject.id);
            if (project) { setWizardProject(project); setWizardMembers(project.members); setProjects(result.projects); }
            setMemberId(''); setCrewPosition(''); setPersonQuery(''); setPeople([]);
        } catch (e) { setError(e.message); }
        finally { setWizardBusy(false); }
    }
    async function saveWizardProject(event) {
        event.preventDefault();
        if (!wizardProject || creating) return;
        setCreating(true); setError('');
        try {
            const result = await api(`/editorial/projects/${wizardProject.id}`, { token, method: 'PATCH', body: { title, description, visibility, eventDate: eventDate || null, eventEndDate: projectDuration === 'multi' ? eventEndDate || null : null } });
            setWizardProject(result.project); setWizardStep(2);
            await reload();
        } catch (e) { setError(e.message); }
        finally { setCreating(false); }
    }
    async function addWizardTask(event) {
        event.preventDefault();
        if (!wizardProject || !wizardTaskTitle.trim() || wizardBusy) return;
        const firstDay = wizardProject.eventDate?.slice(0, 10);
        const lastDay = (wizardProject.eventEndDate || wizardProject.eventDate)?.slice(0, 10);
        const chosenDay = wizardTaskDay || firstDay;
        if (!chosenDay || chosenDay < firstDay || chosenDay > lastDay) { setError('Выберите день выполнения в пределах дат проекта: ' + firstDay + ' — ' + lastDay); return; }
        setWizardBusy(true); setError('');
        try {
            const result = await api(`/editorial/workflow/projects/${wizardProject.id}/tasks`, {
                token, method: 'POST', body: {
                    title: wizardTaskTitle.trim(), description: wizardTaskDescription || wizardProject.description || '', location: wizardTaskLocation.trim(), assigneeId: wizardTaskAssignee || null,
                    parentId: null, isOpen: false, workDate: chosenDay,
                    dueAt: wizardDeadlineAllowed && wizardTaskDue ? new Date(wizardTaskDue).toISOString() : null,
                },
            });
            setWizardTasks(current => [...current, { ...(result.task || { id: String(Date.now()), title: wizardTaskTitle.trim() }), assigneeId: result.task?.assigneeId ?? (wizardTaskAssignee || null) }]);
            setWizardTaskTitle(''); setWizardTaskLocation(''); setWizardTaskDue(''); setWizardTaskAssignee(''); setWizardTaskDay('');
        } catch (e) { setError(e.message); }
        finally { setWizardBusy(false); }
    }
    async function create(event) {
        event.preventDefault();
        if (creating) return;
        setCreating(true); setError('');
        try {
            const result = await api('/editorial/projects', { token, method: 'POST', body: { title, description, visibility, eventDate: eventDate || null, eventEndDate: projectDuration === 'multi' ? eventEndDate || null : null } });
            setWizardProject(result.project); setWizardStep(2); setWizardMembers(result.project.members || []);
            await reload();
        } catch (e) { setError(e.message); }
        finally { setCreating(false); }
    }

    async function saveProjectTitle(event) {
        event.preventDefault();
        const nextTitle=titleDraft.trim();
        if(!selected||savingTitle||!nextTitle||nextTitle.length>120)return;
        setSavingTitle(true);setError('');
        try {await api(`/editorial/projects/${selected.id}`,{token,method:'PATCH',body:{title:nextTitle}});await reload();setEditingTitle(false)}
        catch(e){setError(e.message)}finally{setSavingTitle(false)}
    }
    async function saveProjectBrief(event) {
        event.preventDefault();
        if(!selected||savingBrief||briefDraft.length>5000)return;
        setSavingBrief(true);setError('');
        try{await api(`/editorial/projects/${selected.id}`,{token,method:'PATCH',body:{description:briefDraft}});await reload();setEditingBrief(false)}
        catch(e){setError(e.message)}finally{setSavingBrief(false)}
    }
    async function changeMemberRole(member,role) {
        if(!selected||roleSavingId||member.role===role)return;
        setRoleSavingId(member.userId);setError('');
        try{await api(`/editorial/projects/${selected.id}/members`,{token,method:'POST',body:{userId:member.userId,role,crewPosition:member.crewPosition||null}});await reload()}
        catch(e){setError(e.message)}finally{setRoleSavingId(null)}
    }
    async function addMember(event) {
        event.preventDefault();
        if (!selected || savingMember) return;
        setSavingMember(true); setError('');
        try {
            await api(`/editorial/projects/${selected.id}/members`, { token, method: 'POST', body: { userId: memberId.trim(), role: memberRole, crewPosition: crewPosition || null } });
            setMemberId(''); setPersonQuery(''); setPeople([]); setMemberRole('PARTICIPANT');
            await reload();
        } catch (e) { setError(e.message); }
        finally { setSavingMember(false); }
    }

    async function changeCrewPosition(userId, position) {
        if (!selected || crewSavingId) return;
        setCrewSavingId(userId); setError('');
        try {
            await api(`/editorial/projects/${selected.id}/members/${userId}/crew`, {
                token, method: 'PATCH', body: { crewPosition: position || null },
            });
            await reload();
        } catch (e) { setError(e.message); }
        finally { setCrewSavingId(null); }
    }

    async function deleteCompletedProject() {
        if (!selected?.completedAt || deletingProject) return;
        const confirmation = window.prompt(`Удалить завершённый проект «${selected.title}» со всеми заданиями и материалами? Для подтверждения введите УДАЛИТЬ`);
        if (confirmation !== 'УДАЛИТЬ') return;
        setDeletingProject(true); setError('');
        try {
            await api(`/editorial/projects/${selected.id}`, { token, method: 'DELETE' });
            setProjects(current => current.filter(p => p.id !== selected.id));
            setSelected(null);
        } catch (e) { setError(e.message); }
        finally { setDeletingProject(false); }
    }

    async function toggleProjectCompletion() {
        if (!selected || updatingCompletion) return;
        const completed = !selected.completedAt;
        if (!window.confirm(completed
            ? 'Завершить проект? Он останется в списке, все задания и материалы сохранятся.'
            : 'Вернуть проект в работу?')) return;
        setUpdatingCompletion(true); setError('');
        try {
            const result = await api(`/editorial/projects/${selected.id}`, {
                token, method: 'PATCH', body: { completed },
            });
            setSelected(result.project);
            setProjects(current => current.map(p => p.id === result.project.id ? result.project : p));
        } catch (e) { setError(e.message); }
        finally { setUpdatingCompletion(false); }
    }

    const filteredProjects = projects.filter((project) => `${project.title} ${project.description || ''}`.toLocaleLowerCase('ru').includes(projectQuery.trim().toLocaleLowerCase('ru')));
    const canManage = selected && (user?.role === 'ADMIN' || selected.members.some((m) => m.userId === user?.id && m.role === 'MANAGER'));

    return (
        <div className="editorial-glass__projects editorial-projects-refined editorial-workspace-content space-y-4">
            {fromReviews && <Link to="/app/editorial/reviews" className="inline-flex min-h-11 items-center rounded-lg border border-violet-400 px-3 py-2 text-sm font-semibold text-violet-800 dark:text-violet-200">← Вернуться к проверке</Link>}
            {fromMyTasks && <Link to={"/app/editorial/my-tasks" + (returnStatus ? "?status=" + encodeURIComponent(returnStatus) : "")} className="inline-flex min-h-11 items-center rounded-lg border border-violet-400 px-3 py-2 text-sm font-semibold text-violet-800 dark:text-violet-200">← Вернуться к моим заданиям</Link>}
            {!fromMyTasks && <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-semibold">Проекты</h2><p className="text-xs opacity-60">{projects.length} доступно · управление редакционными задачами</p></div>
                {canCreate && <button type="button" onClick={() => showCreate ? setShowCreate(false) : startWizard()} aria-expanded={showCreate} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 dark:bg-violet-200 dark:text-slate-950 dark:hover:bg-violet-100">{showCreate ? 'Отмена' : '+ Новый проект'}</button>}
            </div>}
            {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
            {showCreate && canCreate && <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/75 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="project-wizard-title" className="editorial-project-wizard flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border p-5 shadow-2xl sm:rounded-3xl">
                    <div className="flex items-center justify-between gap-3">
                        <div><p className="text-xs opacity-70">Шаг {wizardStep} из 3</p><h3 id="project-wizard-title" className="text-lg font-bold">{['','Новый проект','Участники проекта','Задания проекта'][wizardStep]}</h3></div>
                        <button type="button" onClick={() => setShowCreate(false)} aria-label="Закрыть мастер создания" className="rounded-xl border px-3 py-2">✕</button>
                    </div>
                    <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="Этапы создания">{['Проект','Команда','Задания'].map((label,i) => <button type="button" key={label} disabled={!wizardProject && i !== 0} onClick={() => { setError(''); setWizardStep(i + 1); }} aria-current={wizardStep === i+1 ? 'step' : undefined} className={`rounded-lg px-2 py-2 text-center text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${wizardStep === i+1 ? 'bg-violet-600 text-white' : 'editorial-project-wizard-step'}`}>{i+1}. {label}</button>)}</nav>
                    <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pb-2">
                        {error && <p role="alert" className="rounded-xl border border-rose-500/50 p-3 text-sm">{error}</p>}
                        {wizardStep === 1 && <form id="editorial-wizard-project" onSubmit={wizardProject ? saveWizardProject : create} className="space-y-3">
                            <label className="block text-sm">Название проекта<input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
                            <label className="block text-sm">Описание<textarea rows={3} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
                            <fieldset className="space-y-2"><legend className="text-sm font-semibold">Продолжительность проекта</legend><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm"><input type="radio" name="project-duration" checked={projectDuration === 'single'} onChange={() => { setProjectDuration('single'); setEventEndDate(''); }} />Однодневный</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="project-duration" checked={projectDuration === 'multi'} onChange={() => setProjectDuration('multi')} />На несколько дней</label></div></fieldset>
                            <label className="block text-sm">{projectDuration === 'multi' ? 'Дата начала' : 'Дата мероприятия'}<input required type="date" value={eventDate} max={projectDuration === 'multi' && eventEndDate ? eventEndDate : undefined} onChange={e => { setEventDate(e.target.value); setWizardTaskDay(''); }} className="mt-1 w-full rounded-xl border p-3" /></label>
                            {projectDuration === 'multi' && <label className="block text-sm">Дата окончания<input required type="date" min={eventDate || undefined} value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
                            <p className="text-xs opacity-70">Все дни проекта будут видны в календаре участников.</p>
                            <label className="block text-sm">Видимость<select value={visibility} onChange={e => setVisibility(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="CLOSED">Закрытый — по приглашению</option><option value="TEAM">Командный — виден участникам сайта</option></select></label>
                            <button disabled={creating} className="w-full rounded-xl bg-violet-600 p-3 font-semibold text-white disabled:opacity-50">{creating ? 'Сохранение…' : wizardProject ? 'Сохранить и перейти к команде →' : 'Создать проект и продолжить →'}</button>
                        </form>}
                        {wizardStep === 2 && <div className="space-y-3">
                            <p className="text-sm opacity-75">Добавьте участников перед назначением заданий. Можно добавить нескольких подряд.</p>
                            <div className="flex flex-wrap gap-2">{wizardMembers.map(m => <span key={m.id || m.userId} className="editorial-project-wizard-step rounded-lg px-3 py-2 text-xs">{m.user?.fullName || m.user?.username || m.userId} · {m.role === 'MANAGER' ? 'Руководитель' : crewName(m.crewPosition)}</span>)}</div>
                            <form onSubmit={addWizardMember} className="space-y-3">
                                <label className="block text-sm">Найти участника<input value={personQuery} onChange={e => { setPersonQuery(e.target.value); setMemberId(''); }} placeholder="Введите имя или логин" className="mt-1 w-full rounded-xl border p-3" autoComplete="off" /></label>
                                {searching && <p className="text-xs opacity-70">Поиск…</p>}
                                {people.length > 0 && <div className="max-h-40 overflow-auto rounded-xl border p-1">{people.filter(p => !wizardMembers.some(m => m.userId === p.id)).map(p => <button key={p.id} type="button" onClick={() => { setMemberId(p.id); setCrewPosition(p.editorialTeamMembership?.position || ''); setPersonQuery(`${p.fullName || p.username} (@${p.username})`); setPeople([]); }} className="block w-full rounded-lg p-3 text-left text-sm">{p.fullName || p.username} @{p.username}</button>)}</div>}
                                <label className="block text-sm">Должность команды<select value={crewPosition} onChange={e => setCrewPosition(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Без должности</option>{Object.entries(CREW_POSITIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                <button disabled={!memberId || wizardBusy} className="rounded-xl border border-violet-400 px-4 py-3 text-sm font-semibold disabled:opacity-50">+ Добавить участника</button>
                            </form>
                            <button type="button" onClick={() => { setError(''); setWizardStep(3); }} className="w-full rounded-xl bg-violet-600 p-3 font-semibold text-white">Продолжить к заданиям →</button>
                        </div>}
                        {wizardStep === 3 && <div className="space-y-3">
                            <p className="text-sm opacity-75">Создайте первые задания и назначьте их участникам. Можно завершить без заданий.</p>
                            <section aria-label="Распределение заданий по команде" className="editorial-project-wizard-step space-y-3 rounded-xl border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-bold">Команда и назначенные задания</h4>
                                    <span className="text-xs opacity-75">{wizardMembers.filter(m => wizardTasks.some(t => t.assigneeId === m.userId)).length} из {wizardMembers.length} с заданиями</span>
                                </div>
                                {wizardMembers.length === 0 && <p className="text-sm opacity-70">Участники пока не добавлены. Можно назначить задания позже.</p>}
                                <div className="space-y-2">{wizardMembers.map(m => {
                                    const assigned = wizardTasks.filter(t => t.assigneeId === m.userId);
                                    return <button key={m.userId} type="button" onClick={() => { setWizardTaskAssignee(m.userId); setWizardTaskDue(''); }} aria-pressed={wizardTaskAssignee === m.userId} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${wizardTaskAssignee === m.userId ? 'border-violet-500 ring-1 ring-violet-500' : ''}`}>
                                        <span className="min-w-0"><strong className="block truncate">{m.user?.fullName || m.user?.username || m.userId}</strong><span className="block text-xs opacity-70">{m.role === 'MANAGER' ? 'Руководитель' : crewName(m.crewPosition)}</span></span>
                                        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${assigned.length ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>{assigned.length ? `Назначено: ${assigned.length}` : 'Нет заданий'}</span>
                                    </button>;
                                })}</div>
                            </section>
                            {wizardTasks.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold">Созданные задания</h4>{wizardTasks.map((task,i) => <p key={task.id || i} className="editorial-project-wizard-step rounded-lg p-3 text-sm">✓ {task.title}{task.workDate ? ` · ${new Date(task.workDate).toLocaleDateString('ru-RU')}` : ''}{task.assigneeId ? ` · ${wizardMembers.find(m => m.userId === task.assigneeId)?.user?.fullName || wizardMembers.find(m => m.userId === task.assigneeId)?.user?.username || 'Исполнитель назначен'}` : ' · Без исполнителя'}</p>)}</div>}
                            <form onSubmit={addWizardTask} className="space-y-3">
                                <label className="block text-sm">Название задания<input required maxLength={160} value={wizardTaskTitle} onChange={e => setWizardTaskTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
                                <p className="text-xs opacity-75">Задание можно назначить на любой день проекта: {wizardProject?.eventDate?.slice(0,10)} — {(wizardProject?.eventEndDate || wizardProject?.eventDate)?.slice(0,10)}</p>
                                <label className="block text-sm">День выполнения<input type="date" required min={wizardProject?.eventDate?.slice(0, 10)} max={(wizardProject?.eventEndDate || wizardProject?.eventDate)?.slice(0, 10)} value={wizardTaskDay || wizardProject?.eventDate?.slice(0, 10) || ''} onChange={e => setWizardTaskDay(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
                                <label className="block text-sm">Описание задания и требования к кадрам<textarea rows={4} maxLength={10000} value={wizardTaskDescription || wizardProject?.description || ''} onChange={e=>setWizardTaskDescription(e.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="Требования к съёмке, планы, ракурсы…"/><span className="mt-1 block text-xs opacity-65">По умолчанию — описание проекта. Для этого задания его можно изменить.</span></label>
                                <label className="block text-sm">Локация<input maxLength={300} value={wizardTaskLocation} onChange={e => setWizardTaskLocation(e.target.value)} placeholder="Например, актовый зал, корпус 1" className="mt-1 w-full rounded-xl border p-3" /></label>
                                <label className="block text-sm">Исполнитель<select value={wizardTaskAssignee} onChange={e => { setWizardTaskAssignee(e.target.value); setWizardTaskDue(''); }} className="mt-1 w-full rounded-xl border p-3"><option value="">Не назначен</option>{wizardMembers.map(m => <option key={m.userId} value={m.userId}>{m.user?.fullName || m.user?.username || m.userId} — {m.role === 'MANAGER' ? 'Руководитель' : crewName(m.crewPosition)}</option>)}</select></label>
                                {wizardDeadlineAllowed && <label className="block text-sm">Дедлайн<input type="datetime-local" value={wizardTaskDue} onChange={e => setWizardTaskDue(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
                                {selectedWizardMember && !wizardDeadlineAllowed && <p className="text-xs opacity-70">Для этой роли дедлайн не требуется.</p>}
                                <button disabled={wizardBusy || !wizardTaskTitle.trim()} className="rounded-xl border border-violet-400 px-4 py-3 text-sm font-semibold disabled:opacity-50">+ Добавить задание</button>
                            </form>
                            <button type="button" onClick={finishWizard} className="w-full rounded-xl bg-violet-600 p-3 font-semibold text-white">Завершить и открыть проект ✓</button>
                        </div>}
                    </div>
                    {wizardProject && <p className="mt-3 border-t pt-3 text-xs opacity-65">Проект уже сохранён. Если закрыть окно, его можно открыть позже и продолжить настройку.</p>}
                </section>
            </div>}
            <div className="min-w-0 space-y-3">
                <aside className={`min-w-0 space-y-2 ${selected || fromMyTasks ? "hidden" : ""}`} aria-label="Список проектов">
                    {!loading && projects.length > 0 && <label className="block"><span className="sr-only">Поиск проектов</span><input type="search" value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Найти проект…" className="w-full rounded-xl border border-current/15 bg-transparent px-3 py-3 text-sm" /></label>}
                    {loading ? <p role="status" className="p-3 text-sm">Загружаем…</p> : projects.length === 0 ? <p className="rounded-xl border border-current/15 p-4 text-sm opacity-70">Проектов пока нет.</p> : filteredProjects.length === 0 ? <p className="p-3 text-sm opacity-60">По вашему запросу проектов нет.</p> : filteredProjects.map((project) => (
                        <button type="button" key={project.id} onClick={() => { setSelected(project); setProjectTab('operations'); setShowMemberForm(false); }}
                            aria-current={selected?.id === project.id ? 'true' : undefined}
                            className={`block w-full min-w-0 rounded-xl border p-3 text-left transition-colors ${selected?.id === project.id ? 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-300 dark:bg-slate-700 dark:text-white' : 'border-violet-200/60 hover:border-violet-400 dark:border-slate-600'}`}>
                            <strong className="block truncate text-sm">{project.title} {project.completedAt && <span className="ml-2 rounded-lg border border-emerald-400/50 px-2 py-0.5 text-xs font-medium text-emerald-500">Завершён</span>}</strong>
                            <span className="mt-1 block text-xs opacity-60">{project.visibility === 'CLOSED' ? 'Закрытый' : 'Командный'} · {project.members.length} участн.{project.eventDate ? ` · ${new Date(project.eventDate).toLocaleDateString('ru-RU')}${project.eventEndDate ? ' — ' + new Date(project.eventEndDate).toLocaleDateString('ru-RU') : ''}` : ''}</span>
                        </button>
                    ))}
                </aside>
                <main className={`min-w-0 ${selected ? "" : "hidden"}`}>
                    {!selected ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 p-6 text-center text-sm opacity-60">Выберите проект из списка, чтобы открыть рабочее пространство.</div> : (
                        <section className="editorial-glass__surface min-w-0 space-y-4 rounded-2xl border border-violet-200/60 p-3 sm:p-5" aria-label={`Проект ${selected.title}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-semibold">{selected.title}</h3>{canManage && <button type="button" onClick={openProjectEditor} className="rounded-lg border border-violet-400/60 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 dark:bg-violet-200 dark:text-slate-950">Редактировать проект</button>}</div><div className="mt-3 space-y-2 rounded-xl border border-current/15 p-3"><h4 className="text-sm font-semibold">Описание мероприятия и требования к съёмке</h4><p className="whitespace-pre-wrap break-words text-sm opacity-80">{selected.description||'Описание пока не добавлено.'}</p></div></div>{canManage && <button type="button" disabled={updatingCompletion} onClick={toggleProjectCompletion} className="min-h-11 shrink-0 rounded-xl border border-violet-400/60 px-3 py-2 text-sm font-semibold disabled:opacity-50">{updatingCompletion ? 'Сохранение…' : selected.completedAt ? '↻ Вернуть в работу' : '✓ Завершить проект'}</button>}

                            </div>
                            {canManage&&<div className="rounded-xl border border-current/15 p-3 space-y-2">
                               <div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">Даты проекта</strong><p className="text-xs opacity-70">{selected.eventDate?new Date(selected.eventDate).toLocaleDateString('ru-RU'):'Не указана'}{selected.eventEndDate?' — '+new Date(selected.eventEndDate).toLocaleDateString('ru-RU'):' · однодневный проект'}</p></div><button type="button" onClick={()=>editingProjectDates?setEditingProjectDates(false):editProjectDates()} className="rounded-lg border border-violet-400/60 px-3 py-2 text-sm">{editingProjectDates?'Отмена':'Изменить даты'}</button></div>
                               {editingProjectDates&&<form onSubmit={saveProjectDates} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Дата начала<input type="date" required className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={projectStartDraft} max={projectEndDraft||undefined} onChange={e=>setProjectStartDraft(e.target.value)}/></label><label className="text-sm">Дата окончания (для многодневного проекта)<input type="date" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" min={projectStartDraft||undefined} value={projectEndDraft} onChange={e=>setProjectEndDraft(e.target.value)}/></label><p className="sm:col-span-2 text-xs opacity-70">После сохранения заданию можно назначить любой день между датами включительно. Уже созданные задания не изменятся.</p><button disabled={savingProjectDates||!projectStartDraft||(!!projectEndDraft&&projectEndDraft<projectStartDraft)} className="sm:col-span-2 rounded-xl bg-violet-600 text-white px-4 py-2 disabled:opacity-50">{savingProjectDates?'Сохранение…':'Сохранить даты проекта'}</button></form>}
                             </div>}
                            {selected.completedAt && (user?.role === 'ADMIN' || selected.createdById === user?.id) && <button type="button" disabled={deletingProject} onClick={deleteCompletedProject} className="min-h-11 rounded-xl border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-500 disabled:opacity-50">{deletingProject ? 'Удаление…' : 'Удалить завершённый проект'}</button>}
                            {selected.completedAt && <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm">✓ Проект завершён{selected.completedAt ? ` · ${new Date(selected.completedAt).toLocaleDateString('ru-RU')}` : ''}. Задания и материалы сохранены.</div>}
                            {!fromMyTasks && <div className="flex gap-2 border-b border-current/10 pb-2" role="tablist" aria-label="Раздел проекта">
                                <button type="button" role="tab" aria-selected={projectTab === 'operations'} onClick={() => setProjectTab('operations')} className={`rounded-lg px-3 py-2 text-sm ${projectTab === 'operations' ? 'bg-violet-600 text-white font-semibold dark:bg-violet-200 dark:text-slate-950' : 'opacity-65'}`}>Контроль</button>
                                <button type="button" role="tab" aria-selected={projectTab === 'tasks'} onClick={() => setProjectTab('tasks')} className={`rounded-lg px-3 py-2 text-sm ${projectTab === 'tasks' ? 'bg-violet-600 text-white font-semibold dark:bg-violet-200 dark:text-slate-950' : 'text-violet-700 opacity-75 dark:text-slate-100'}`}>Задания</button>
                                <button type="button" role="tab" aria-selected={projectTab === 'team'} onClick={() => setProjectTab('team')} className={`rounded-lg px-3 py-2 text-sm ${projectTab === 'team' ? 'bg-violet-600 text-white font-semibold dark:bg-violet-200 dark:text-slate-950' : 'opacity-65'}`}>Команда · {selected.members.length}</button>
                            </div>}
                            {projectTab === 'operations' ? <EditorialProjectOperations key={selected.id} project={selected} onOpenTasks={() => setProjectTab('tasks')} /> : projectTab === 'tasks' ? <EditorialWorkflow key={selected.id} project={selected} onError={setError} linkedTaskId={selected.id === linkedProjectId ? linkedTaskId : null} linkedTab={linkedTab} onTaskClose={fromMyTasks ? () => navigate("/app/editorial/my-tasks" + (returnStatus ? "?status=" + encodeURIComponent(returnStatus) : "")) : undefined} /> : <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Участники</h4>{canManage && <button type="button" onClick={() => setShowMemberForm((v) => !v)} className="rounded-lg border border-current/20 px-3 py-2 text-xs">{showMemberForm ? 'Скрыть форму' : '+ Участник'}</button>}</div>
                                {selected.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 py-2 text-sm"><span className="min-w-0 break-words">{member.user?.fullName || member.userId} <span className="opacity-50">@{member.user?.username}</span></span><div className="flex flex-wrap items-center gap-2"><span className="text-xs opacity-60">{member.role === 'MANAGER' ? 'Руководитель' : crewName(member.crewPosition)}</span>{canManage && member.role !== 'MANAGER' && <select aria-label={`Роль: ${member.user?.fullName || member.userId}`} disabled={!!crewSavingId} value={member.crewPosition || ''} onChange={e => changeCrewPosition(member.userId, e.target.value)} className="min-h-10 rounded-lg border p-2 text-xs"><option value="">Без должности</option>{Object.entries(CREW_POSITIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>}</div>{canManage?<select aria-label={`Права участника ${member.user?.fullName||member.userId}`} disabled={!!roleSavingId||(member.userId===selected.createdById)} value={member.role} onChange={e=>changeMemberRole(member,e.target.value)} className="min-h-10 rounded-lg border border-current/20 bg-transparent p-2 text-xs"><option value="MANAGER">Руководитель</option><option value="EDITOR">Редактор</option><option value="PARTICIPANT">Участник</option><option value="OBSERVER">Наблюдатель</option></select>:<span className="text-xs opacity-60">{({ MANAGER: 'Руководитель', EDITOR: 'Редактор', PARTICIPANT: 'Участник', OBSERVER: 'Наблюдатель' })[member.role] || member.role}</span>}</div>)}
                                {canManage && showMemberForm && <form onSubmit={addMember} className="space-y-3 rounded-xl border border-current/10 p-3">
                                    <label className="block text-sm">Найти участника<input value={personQuery} onChange={(e) => { setPersonQuery(e.target.value); setMemberId(''); }} placeholder="Имя или логин" autoComplete="off" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2" /></label>
                                    {searching && <p className="text-xs opacity-60">Поиск…</p>}
                                    {people.length > 0 && <div className="max-h-44 overflow-auto rounded-lg border border-current/15 p-1">{people.map((person) => <button type="button" key={person.id} onClick={() => { setMemberId(person.id); setCrewPosition(person.editorialTeamMembership?.position || ''); setPersonQuery(person.fullName + ' (@' + person.username + ')'); setPeople([]); }} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-current/10">{person.fullName} <span className="opacity-60">@{person.username}</span></button>)}</div>}
                                    <label className="block text-sm">Должность команды<select value={crewPosition} onChange={e => setCrewPosition(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Без должности</option>{Object.entries(CREW_POSITIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                    <button disabled={!memberId || savingMember} className="rounded-lg border border-current/30 px-3 py-2 text-sm disabled:opacity-50">{savingMember ? 'Сохранение…' : 'Добавить участника'}</button>
                                </form>}
                            </div>}
                        </section>
                    )}
                </main>
            </div>
            {projectEditorOpen && selected && canManage && <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/75 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !savingProjectEditor && !savingMember) setProjectEditorOpen(false); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="editorial-project-edit-title" className="editorial-project-wizard flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border p-4 shadow-2xl sm:rounded-3xl sm:p-6">
                    <header className="flex items-start justify-between gap-3 border-b border-current/10 pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-500">Настройки проекта</p><h3 id="editorial-project-edit-title" className="text-xl font-bold">Редактирование проекта</h3><p className="mt-1 text-sm opacity-65">Основные данные, команда и роли участников</p></div><button type="button" disabled={savingProjectEditor || savingMember} onClick={() => setProjectEditorOpen(false)} aria-label="Закрыть редактор проекта" className="rounded-xl border border-current/20 px-3 py-2">✕</button></header>
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-4">
                        <form id="editorial-project-edit-form" onSubmit={saveProjectEditor} className="space-y-3">
                            <label className="block text-sm font-medium">Название проекта<input autoFocus required maxLength={120} value={titleDraft} onChange={e => setTitleDraft(e.target.value)} className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3"/></label>
                            <label className="block text-sm font-medium">Описание и требования<textarea rows={5} maxLength={5000} value={briefDraft} onChange={e => setBriefDraft(e.target.value)} placeholder="Цель проекта, требования к съёмке и материалам…" className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3"/></label>
                            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Дата начала<input required type="date" value={projectStartDraft} max={projectEndDraft || undefined} onChange={e => setProjectStartDraft(e.target.value)} className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3"/></label><label className="block text-sm font-medium">Дата окончания<input type="date" value={projectEndDraft} min={projectStartDraft || undefined} onChange={e => setProjectEndDraft(e.target.value)} className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3"/></label></div>
                            <p className="text-xs opacity-65">Для однодневного проекта оставьте дату окончания пустой. Изменение дат не переносит существующие задания автоматически.</p>
                        </form>
                        <section className="space-y-3 border-t border-current/10 pt-4"><div><h4 className="font-semibold">Команда проекта</h4><p className="text-xs opacity-65">{selected.members.length} участников · роли и права доступа</p></div>
                            <div className="space-y-2">{selected.members.map(member => <div key={member.id} className="grid gap-2 rounded-xl border border-current/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                                <div className="min-w-0"><p className="break-words text-sm font-medium">{member.user?.fullName || member.userId}</p><p className="text-xs opacity-60">@{member.user?.username || 'без логина'}</p></div>
                                <label className="text-xs">Должность команды<select aria-label={'Должность команды: '+(member.user?.fullName||member.userId)} disabled={!!crewSavingId || member.role === 'MANAGER'} value={member.crewPosition || ''} onChange={e => changeCrewPosition(member.userId,e.target.value)} className="mt-1 block w-full rounded-lg border border-current/20 bg-transparent p-2"><option value="">Без должности</option>{Object.entries(CREW_POSITIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                <label className="text-xs">Права доступа<select aria-label={'Права участника '+(member.user?.fullName||member.userId)} disabled={!!roleSavingId || member.userId === selected.createdById} value={member.role} onChange={e => changeMemberRole(member,e.target.value)} className="mt-1 block w-full rounded-lg border border-current/20 bg-transparent p-2"><option value="MANAGER">Руководитель</option><option value="EDITOR">Редактор</option><option value="PARTICIPANT">Участник</option><option value="OBSERVER">Наблюдатель</option></select></label>
                            </div>)}</div>
                            <form onSubmit={addMember} className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-500/5 p-3"><h5 className="text-sm font-semibold">Добавить участника</h5>
                                <label className="block text-sm">Поиск по имени или логину<input value={personQuery} onChange={e => { setPersonQuery(e.target.value); setMemberId(''); }} placeholder="Введите минимум 2 символа" autoComplete="off" className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3"/></label>
                                {searching && <p role="status" className="text-xs opacity-65">Поиск участников…</p>}
                                {people.length > 0 && <div className="max-h-40 overflow-auto rounded-lg border border-current/15 p-1">{people.map(person => <button type="button" key={person.id} onClick={() => { setMemberId(person.id); setCrewPosition(person.editorialTeamMembership?.position || ''); setPersonQuery(person.fullName+' (@'+person.username+')'); setPeople([]); }} className={'block w-full rounded-lg p-2 text-left text-sm hover:bg-violet-500/10 '+(memberId===person.id?'bg-violet-500/15':'')}>{person.fullName} <span className="opacity-60">@{person.username}</span></button>)}</div>}
                                <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Права доступа<select value={memberRole} onChange={e => setMemberRole(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3"><option value="PARTICIPANT">Участник</option><option value="OBSERVER">Наблюдатель</option><option value="EDITOR">Редактор</option><option value="MANAGER">Руководитель</option></select></label><label className="text-sm">Должность команды<select value={crewPosition} onChange={e => setCrewPosition(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3"><option value="">Без должности</option>{Object.entries(CREW_POSITIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
                                <button type="submit" disabled={!memberId || savingMember} className="rounded-xl border border-violet-400/50 px-4 py-2 text-sm font-semibold disabled:opacity-50">{savingMember ? 'Добавление…' : 'Добавить в проект'}</button>
                            </form>
                        </section>
                    </div>
                    <footer className="flex flex-col-reverse gap-2 border-t border-current/10 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={savingProjectEditor || savingMember} onClick={() => setProjectEditorOpen(false)} className="rounded-xl border border-current/20 px-4 py-3 text-sm font-semibold">Закрыть</button><button type="submit" form="editorial-project-edit-form" disabled={savingProjectEditor || !titleDraft.trim() || !projectStartDraft || (!!projectEndDraft && projectEndDraft < projectStartDraft)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-violet-200 dark:text-slate-950">{savingProjectEditor ? 'Сохранение…' : 'Сохранить изменения'}</button></footer>
                </section>
            </div>}
        </div>
    );
}
