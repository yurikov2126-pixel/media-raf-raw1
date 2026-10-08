import { useEffect, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const blank = { headline: '', about: '', specialization: '', skills: [], links: [], featuredPostIds: [], accent: 'violet', layout: 'grid' };
const emptyProject = { title: '', description: '', role: '', collaborators: '', coverUrl: '', link: '' };
const colors = { violet: '#a78bfa', pink: '#f472b6', cyan: '#22d3ee', amber: '#fbbf24', emerald: '#34d399' };
function postImage(p) { if (!p.mediaUrl || p.mediaType === 'video') return null; if (p.mediaType === 'gallery') { try { return JSON.parse(p.mediaUrl)[0]; } catch { return null; } } return p.mediaUrl; }
export default function ProfilePortfolio3({ username, posts = [], isMe }) {
    const { token } = useAuth();
    const [data, setData] = useState({ portfolio: blank, projects: [] });
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(blank);
    const [projectEdit, setProjectEdit] = useState(null);
    const [projectDraft, setProjectDraft] = useState(emptyProject);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = () => api(`/portfolio/user/${encodeURIComponent(username)}`, { token }).then(setData).catch((e) => setError(e.message));
    useEffect(() => { setEditing(false); setProjectEdit(null); load(); }, [username, token]);
    const p = data.portfolio || blank;
    const accent = colors[p.accent] || colors.violet;
    const featured = (p.featuredPostIds || []).map((id) => posts.find((post) => post.id === id)).filter(Boolean);
    const save = async () => {
        setBusy(true); setError('');
        try { const updated = await api('/portfolio/me', { method: 'PUT', token, body: draft }); setData((d) => ({ ...d, portfolio: updated })); setEditing(false); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const saveProject = async () => {
        setBusy(true); setError('');
        try {
            await api(projectEdit === 'new' ? '/portfolio/projects' : `/portfolio/projects/${projectEdit}`, { method: projectEdit === 'new' ? 'POST' : 'PATCH', token, body: projectDraft });
            await load(); setProjectEdit(null);
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const remove = async (id) => {
        if (!window.confirm('Удалить проект?')) return;
        try { await api(`/portfolio/projects/${id}`, { method: 'DELETE', token }); await load(); } catch (e) { setError(e.message); }
    };
    const startProject = (project) => { setError(''); setProjectEdit(project?.id || 'new'); setProjectDraft(project ? { title: project.title, description: project.description, role: project.role, collaborators: project.collaborators, coverUrl: project.coverUrl || '', link: project.link } : { ...emptyProject }); };
    return <section className="space-y-6 py-6" style={{ '--portfolio-accent': accent }}>
        <div className="flex justify-between items-start gap-3"><div><div className="text-xs tracking-widest uppercase" style={{ color: accent }}>Creative portfolio</div><h2 className="text-2xl font-bold mt-1">Портфолио</h2></div>{isMe && <button className="btn-primary" type="button" onClick={() => { setDraft({ ...p, skills: [...(p.skills || [])], links: [...(p.links || [])], featuredPostIds: [...(p.featuredPostIds || [])] }); setEditing(true); setError(''); }}>Редактировать</button>}</div>
        {error && <p role="alert" className="text-pink text-sm">{error}</p>}
        {editing && <div className="card p-4 space-y-4">
            <h3 className="font-bold">Редактор портфолио</h3>
            {[[ 'headline', 'Заголовок', 100 ], [ 'specialization', 'Специализация', 100 ]].map(([key, label, max]) => <label key={key} className="block text-sm">{label}<input className="input w-full mt-1" maxLength={max} value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /></label>)}
            <label className="block text-sm">О себе<textarea className="input w-full mt-1" rows={4} maxLength={2000} value={draft.about} onChange={(e) => setDraft((d) => ({ ...d, about: e.target.value }))} /></label>
            <label className="block text-sm">Навыки (через запятую, до 20)<input className="input w-full mt-1" value={draft.skills.join(', ')} onChange={(e) => setDraft((d) => ({ ...d, skills: e.target.value.split(',').slice(0, 20).map((x) => x.trimStart()) }))} /></label>
            <div className="text-sm font-semibold">Ссылки на работы (до 8)</div>
            {draft.links.map((link, index) => <div key={index} className="flex flex-wrap gap-2"><input aria-label="Название ссылки" className="input flex-1 min-w-24" placeholder="Название" maxLength={50} value={link.label} onChange={(e) => setDraft((d) => ({ ...d, links: d.links.map((x, i) => i === index ? { ...x, label: e.target.value } : x) }))} /><input aria-label="Адрес ссылки" className="input flex-[2] min-w-32" type="url" placeholder="https://" value={link.url} onChange={(e) => setDraft((d) => ({ ...d, links: d.links.map((x, i) => i === index ? { ...x, url: e.target.value } : x) }))} /><button className="btn-ghost" type="button" onClick={() => setDraft((d) => ({ ...d, links: d.links.filter((_, i) => i !== index) }))}>✕</button></div>)}
            {draft.links.length < 8 && <button type="button" className="btn-ghost" onClick={() => setDraft((d) => ({ ...d, links: [...d.links, { label: '', url: '' }] }))}>+ Ссылка</button>}
            <div className="font-semibold text-sm">Избранные публикации ({draft.featuredPostIds.length}/6)</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">{posts.map((post) => { const selected = draft.featuredPostIds.includes(post.id); return <button type="button" aria-pressed={selected} key={post.id} className={`rounded-xl p-2 text-left border ${selected ? 'border-violet-400' : 'border-white/10'}`} onClick={() => setDraft((d) => ({ ...d, featuredPostIds: selected ? d.featuredPostIds.filter((id) => id !== post.id) : d.featuredPostIds.length < 6 ? [...d.featuredPostIds, post.id] : d.featuredPostIds }))}>{postImage(post) && <img className="w-full h-20 object-cover rounded-lg" src={resolveUrl(postImage(post))} alt="" />}<span className="block text-xs truncate mt-1">{selected ? '✓ ' : ''}{post.content || 'Фотография'}</span></button>; })}</div>
            <div className="font-semibold text-sm">Оформление профиля</div>
            <div className="flex flex-wrap gap-3">{Object.entries(colors).map(([key, color]) => <button key={key} type="button" aria-label={`Цвет ${key}`} aria-pressed={draft.accent === key} className={`w-10 h-10 rounded-full ${draft.accent === key ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`} style={{ backgroundColor: color }} onClick={() => setDraft((d) => ({ ...d, accent: key }))} />)}</div>
            <label className="block text-sm">Расположение работ<select className="input w-full mt-1" value={draft.layout} onChange={(e) => setDraft((d) => ({ ...d, layout: e.target.value }))}><option value="grid">Сетка</option><option value="list">Список</option></select></label>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Отмена</button><button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить'}</button></div>
        </div>}
        {(p.headline || p.about || p.specialization || p.skills?.length || p.links?.length) && <div className="card p-5 space-y-3" style={{ borderColor: accent + '66' }}>{p.headline && <h3 className="text-xl font-bold">{p.headline}</h3>}{p.specialization && <p style={{ color: accent }}>{p.specialization}</p>}{p.about && <p className="whitespace-pre-wrap text-white/70">{p.about}</p>}{p.skills?.length > 0 && <div className="flex flex-wrap gap-2">{p.skills.map((skill, i) => <span key={i} className="chip bg-white/5">{skill}</span>)}</div>}{p.links?.length > 0 && <div className="flex flex-wrap gap-3">{p.links.map((link, i) => <a key={i} className="underline text-sm" style={{ color: accent }} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div>}</div>}
        <div><h3 className="text-lg font-bold mb-3">⭐ Избранные работы</h3>{featured.length ? <div className={p.layout === 'list' ? 'space-y-3' : 'grid grid-cols-2 sm:grid-cols-3 gap-3'}>{featured.map((post) => <div key={post.id} className="card overflow-hidden">{postImage(post) && <img src={resolveUrl(postImage(post))} className={p.layout === 'list' ? 'w-full max-h-48 object-cover' : 'w-full aspect-square object-cover'} alt="" loading="lazy" />}<p className="p-3 text-sm line-clamp-3">{post.content || 'Фотография'}</p></div>)}</div> : <p className="text-white/40 text-sm">Избранных работ пока нет</p>}</div>
        <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold">🎬 Творческие проекты</h3>{isMe && <button type="button" className="btn-primary" onClick={() => startProject(null)}>+ Проект</button>}</div>
        {projectEdit && <div className="card p-4 space-y-3"><h4 className="font-bold">{projectEdit === 'new' ? 'Новый проект' : 'Редактирование проекта'}</h4>{[['title','Название',100],['role','Моя роль',100],['collaborators','Участники',500],['coverUrl','URL обложки',1000],['link','Ссылка на проект',500]].map(([key,label,max]) => <label key={key} className="block text-sm">{label}<input className="input w-full mt-1" maxLength={max} value={projectDraft[key]} onChange={(e) => setProjectDraft((d) => ({ ...d, [key]: e.target.value }))} /></label>)}<label className="block text-sm">Описание<textarea className="input w-full mt-1" rows={3} maxLength={2000} value={projectDraft.description} onChange={(e) => setProjectDraft((d) => ({ ...d, description: e.target.value }))} /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setProjectEdit(null)}>Отмена</button><button type="button" className="btn-primary" disabled={busy || !projectDraft.title.trim()} onClick={saveProject}>Сохранить</button></div></div>}
        {data.projects.length ? <div className={p.layout === 'list' ? 'space-y-3' : 'grid sm:grid-cols-2 gap-4'}>{data.projects.map((project) => <article key={project.id} className="card overflow-hidden">{project.coverUrl && <img src={resolveUrl(project.coverUrl)} alt="" className="w-full aspect-video object-cover" loading="lazy" />}<div className="p-4 space-y-2"><h4 className="font-bold text-lg">{project.title}</h4>{project.role && <p className="text-sm" style={{ color: accent }}>{project.role}</p>}{project.description && <p className="text-sm text-white/70 whitespace-pre-wrap">{project.description}</p>}{project.collaborators && <p className="text-xs text-white/50">Участники: {project.collaborators}</p>}{project.link && <a href={project.link} target="_blank" rel="noopener noreferrer" className="underline text-sm" style={{ color: accent }}>Посмотреть проект ↗</a>}{isMe && <div className="flex gap-2 pt-2"><button className="btn-ghost text-xs" onClick={() => startProject(project)}>Изменить</button><button className="btn-ghost text-xs" onClick={() => remove(project.id)}>Удалить</button></div>}</div></article>)}</div> : <p className="text-sm text-white/40">Проектов пока нет</p>}
    </section>;
}
