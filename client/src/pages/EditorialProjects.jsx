import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function EditorialProjects() {
    const { token, user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState('CLOSED');
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState(null);
    const [memberId, setMemberId] = useState('');
    const [memberRole, setMemberRole] = useState('PARTICIPANT');
    const [savingMember, setSavingMember] = useState(false);
    const canCreate = ['ADMIN', 'MENTOR'].includes(user?.role);

    async function reload() {
        const result = await api('/editorial/projects', { token });
        setProjects(result.projects);
        setSelected((current) => current ? result.projects.find((p) => p.id === current.id) || null : null);
    }
    useEffect(() => {
        let active = true;
        api('/editorial/projects', { token })
            .then((result) => { if (active) setProjects(result.projects); })
            .catch((e) => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token]);

    async function create(event) {
        event.preventDefault();
        if (creating) return;
        setCreating(true); setError('');
        try {
            const result = await api('/editorial/projects', { token, method: 'POST', body: { title, description, visibility } });
            setTitle(''); setDescription(''); setSelected(result.project);
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
            setMemberId('');
            await reload();
        } catch (e) { setError(e.message); }
        finally { setSavingMember(false); }
    }

    const canManage = selected && (user?.role === 'ADMIN' || selected.members.some((m) => m.userId === user?.id && m.role === 'MANAGER'));

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-semibold">Проекты</h2>
                <p className="mt-1 text-sm opacity-70">Командные проекты доступны участникам редакции; закрытые — только приглашённым.</p>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
            {canCreate && (
                <form onSubmit={create} className="rounded-2xl border border-current/15 p-4 space-y-3">
                    <h3 className="font-semibold">Новый проект</h3>
                    <label className="block text-sm">Название
                        <input className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
                    </label>
                    <label className="block text-sm">Описание
                        <textarea className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={2} />
                    </label>
                    <label className="block text-sm">Видимость
                        <select className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                            <option value="CLOSED">Закрытый — по приглашению</option>
                            <option value="TEAM">Командный — виден участникам сайта</option>
                        </select>
                    </label>
                    <button disabled={creating} className="rounded-xl border border-current/30 px-4 py-2 font-medium disabled:opacity-50">{creating ? 'Создание…' : 'Создать проект'}</button>
                </form>
            )}
            {loading ? <p role="status">Загружаем проекты…</p> : projects.length === 0 ? <p className="rounded-xl border border-current/15 p-5 opacity-70">Пока нет доступных проектов.</p> : (
                <div className="grid gap-3 md:grid-cols-2">
                    {projects.map((project) => (
                        <button key={project.id} type="button" onClick={() => setSelected(project)}
                            className="rounded-2xl border border-current/15 p-4 text-left hover:border-current/40">
                            <span className="text-xs opacity-60">{project.visibility === 'CLOSED' ? 'Закрытый' : 'Командный'} · {project.members.length} участн.</span>
                            <strong className="mt-2 block break-words">{project.title}</strong>
                            <span className="mt-1 block text-sm opacity-70 break-words">{project.description || 'Без описания'}</span>
                        </button>
                    ))}
                </div>
            )}
            {selected && (
                <section className="rounded-2xl border border-current/20 p-4 space-y-3" aria-label="Участники проекта">
                    <div className="flex items-start justify-between gap-2">
                        <div><h3 className="text-lg font-semibold">{selected.title}</h3><p className="text-sm opacity-60">Участники проекта</p></div>
                        <button className="rounded-lg border border-current/20 px-3 py-1" onClick={() => setSelected(null)}>Закрыть</button>
                    </div>
                    {selected.members.map((member) => (
                        <div key={member.id} className="flex flex-wrap justify-between gap-2 border-b border-current/10 py-2 text-sm">
                            <span>{member.user?.fullName || member.userId} <span className="opacity-50">@{member.user?.username}</span></span>
                            <span className="opacity-70">{({ MANAGER: 'Руководитель', EDITOR: 'Редактор', PARTICIPANT: 'Участник', OBSERVER: 'Наблюдатель' })[member.role] || member.role}</span>
                        </div>
                    ))}
                    {canManage && (
                        <form onSubmit={addMember} className="space-y-2">
                            <p className="text-sm font-medium">Добавить или изменить участника</p>
                            <label className="block text-xs">ID пользователя
                                <input required value={memberId} onChange={(e) => setMemberId(e.target.value)} className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3" placeholder="ID пользователя из профиля" />
                            </label>
                            <label className="block text-xs">Роль
                                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="mt-1 w-full rounded-xl border border-current/20 bg-transparent p-3">
                                    <option value="PARTICIPANT">Участник</option><option value="EDITOR">Редактор</option>
                                    <option value="OBSERVER">Наблюдатель</option><option value="MANAGER">Руководитель</option>
                                </select>
                            </label>
                            <button disabled={savingMember} className="rounded-xl border border-current/30 px-4 py-2 disabled:opacity-50">{savingMember ? 'Сохранение…' : 'Сохранить участника'}</button>
                        </form>
                    )}
                </section>
            )}
        </div>
    );
}
