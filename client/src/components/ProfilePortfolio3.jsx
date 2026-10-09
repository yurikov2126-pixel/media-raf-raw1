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
    return <section className="profile-portfolio3 space-y-6 py-6" style={{ '--portfolio-accent': accent }}>
        <header className="profile-portfolio3__hero relative overflow-hidden rounded-[28px] border border-white/10 bg-[#15131e] px-5 py-8 sm:px-9 sm:py-11">
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at 95% 0%, ${accent}55, transparent 55%)` }} />
            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div className="min-w-0 max-w-2xl">
                    <p className="text-[11px] uppercase tracking-[.24em] font-bold mb-4" style={{ color: accent }}>MEDIA · CREATIVE PORTFOLIO</p>
                    <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight break-words">{p.headline || 'Мои работы. Мой стиль.'}</h2>
                    <p className="profile-portfolio3__hero-subtitle text-white/60 mt-4 text-sm sm:text-base leading-relaxed">{p.specialization || 'Творческое портфолио участника медиацентра'}</p>
                </div>
                {isMe && <button className="profile-portfolio3__hero-button shrink-0 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-semibold transition" type="button" onClick={() => { setDraft({ ...p, skills: [...(p.skills || [])], links: [...(p.links || [])], featuredPostIds: [...(p.featuredPostIds || [])] }); setEditing(true); setError(''); }}>✎ Настроить портфолио</button>}
            </div>
            <div className="relative flex flex-wrap gap-5 mt-8 pt-5 border-t border-white/10 text-sm">
                <span><strong className="profile-portfolio3__hero-number text-white text-xl mr-2">{featured.length}</strong><span className="profile-portfolio3__hero-meta text-white/50">избранных работ</span></span>
                <span><strong className="text-white text-xl mr-2">{data.projects.length}</strong><span className="text-white/50">проектов</span></span>
                {p.skills?.length > 0 && <span><strong className="text-white text-xl mr-2">{p.skills.length}</strong><span className="text-white/50">навыков</span></span>}
            </div>
        </header>
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
        {(p.about || p.skills?.length || p.links?.length) && <section className="grid md:grid-cols-[minmax(0,1.7fr)_minmax(220px,1fr)] gap-4">
            {p.about && <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-7"><div className="text-xs uppercase tracking-[.18em] text-white/40 font-semibold mb-4">Обо мне</div><p className="text-white/80 leading-7 whitespace-pre-wrap">{p.about}</p></div>}
            {(p.skills?.length > 0 || p.links?.length > 0) && <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-7 space-y-6">
                {p.skills?.length > 0 && <div><div className="text-xs uppercase tracking-[.18em] text-white/40 font-semibold mb-3">Навыки</div><div className="flex flex-wrap gap-2">{p.skills.map((skill, i) => <span key={i} className="rounded-lg bg-white/[.07] border border-white/10 px-3 py-1.5 text-xs text-white/80">{skill}</span>)}</div></div>}
                {p.links?.length > 0 && <div><div className="text-xs uppercase tracking-[.18em] text-white/40 font-semibold mb-3">Ссылки</div><div className="space-y-2">{p.links.map((link, i) => <a key={i} className="flex items-center justify-between gap-2 rounded-lg p-2 -mx-2 hover:bg-white/5 text-sm" style={{ color: accent }} href={link.url} target="_blank" rel="noopener noreferrer"><span className="truncate">{link.label}</span><span aria-hidden="true">↗</span></a>)}</div></div>}
            </div>}
        </section>}
        <section className="space-y-4">
            <div className="flex justify-between items-end gap-3 border-b border-white/10 pb-4"><div><div className="text-[11px] uppercase tracking-[.2em] font-semibold mb-2" style={{ color: accent }}>SELECTED WORK</div><h3 className="text-2xl font-bold">Избранные работы</h3></div><span className="text-xs text-white/40">{featured.length} / 6</span></div>
            {featured.length ? <div className={p.layout === 'list' ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4'}>{featured.map((post, index) => <button type="button" key={post.id} onClick={() => window.dispatchEvent(new CustomEvent('mrr:profile-media', { detail: { postId: post.id } }))} className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#171520] text-left ${p.layout === 'list' ? 'flex items-center min-h-36' : 'aspect-[4/5]'}`}>
                {postImage(post) ? <img src={resolveUrl(postImage(post))} alt="" loading="lazy" className={`${p.layout === 'list' ? 'w-2/5 h-40' : 'absolute inset-0 w-full h-full'} object-cover transition-transform duration-500 group-hover:scale-105`} /> : <div className="absolute inset-0 bg-white/5" />}
                <div className={p.layout === 'list' ? 'p-4 flex-1 min-w-0' : 'absolute inset-x-0 bottom-0 p-3 sm:p-5 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent'}>
                    <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: accent }}>Работа {String(index + 1).padStart(2, '0')}</div><p className="font-semibold text-sm sm:text-base line-clamp-2 text-white">{post.content || 'Без названия'}</p>
                </div>
            </button>)}</div> : <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] px-6 py-10 text-center"><p className="font-semibold">Здесь будут лучшие работы</p><p className="profile-portfolio3__empty-description text-sm text-white/45 mt-2">{isMe ? 'Нажмите «Настроить портфолио» и выберите до шести публикаций.' : 'Автор пока не выбрал избранные публикации.'}</p></div>}
        </section>
        <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4"><div><div className="text-[11px] uppercase tracking-[.2em] font-semibold mb-2" style={{ color: accent }}>CREATIVE PROJECTS</div><h3 className="text-2xl font-bold">Проекты</h3></div>{isMe && <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-black" style={{ backgroundColor: accent }} onClick={() => startProject(null)}>+ Добавить проект</button>}</div>
        {projectEdit && <div className="card p-4 space-y-3"><h4 className="font-bold">{projectEdit === 'new' ? 'Новый проект' : 'Редактирование проекта'}</h4>{[['title','Название',100],['role','Моя роль',100],['collaborators','Участники',500],['coverUrl','URL обложки',1000],['link','Ссылка на проект',500]].map(([key,label,max]) => <label key={key} className="block text-sm">{label}<input className="input w-full mt-1" maxLength={max} value={projectDraft[key]} onChange={(e) => setProjectDraft((d) => ({ ...d, [key]: e.target.value }))} /></label>)}<label className="block text-sm">Описание<textarea className="input w-full mt-1" rows={3} maxLength={2000} value={projectDraft.description} onChange={(e) => setProjectDraft((d) => ({ ...d, description: e.target.value }))} /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setProjectEdit(null)}>Отмена</button><button type="button" className="btn-primary" disabled={busy || !projectDraft.title.trim()} onClick={saveProject}>Сохранить</button></div></div>}
            {data.projects.length ? <div className={p.layout === 'list' ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>{data.projects.map((project, index) => <article key={project.id} className="profile-portfolio3__dark-card group rounded-2xl overflow-hidden border border-white/10 bg-[#171520]">
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-white/10 to-transparent">{project.coverUrl ? <img src={resolveUrl(project.coverUrl)} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/10">{String(index + 1).padStart(2, '0')}</div>}<span className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] tracking-widest uppercase text-white/80">PROJECT {String(index + 1).padStart(2, '0')}</span></div>
                <div className="p-5 space-y-3"><div className="flex justify-between items-start gap-3"><h4 className="text-xl font-bold leading-tight">{project.title}</h4>{project.role && <span className="shrink-0 max-w-[45%] truncate rounded-full px-3 py-1 text-[11px] font-semibold" style={{ backgroundColor: accent + '22', color: accent }}>{project.role}</span>}</div>
                {project.description && <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{project.description}</p>}
                {project.collaborators && <p className="text-xs text-white/40">Команда: {project.collaborators}</p>}
                <div className="flex flex-wrap items-center gap-3 pt-2">{project.link && <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold" style={{ color: accent }}>Смотреть проект ↗</a>}{isMe && <div className="flex gap-2 ml-auto"><button type="button" className="text-xs text-white/60 hover:text-white" onClick={() => startProject(project)}>Изменить</button><button type="button" className="text-xs text-white/40 hover:text-rose-400" onClick={() => remove(project.id)}>Удалить</button></div>}</div>
                </div>
            </article>)}</div> : <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] px-6 py-10 text-center"><p className="font-semibold">Пока нет проектов</p><p className="text-sm text-white/45 mt-2">{isMe ? 'Добавьте съёмку, видео или другой проект, которым гордитесь.' : 'Автор ещё не добавил проекты.'}</p></div>}
        </section>
    </section>;
}
