import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
const media = file => file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf';
const sizeText = size => size >= 1073741824 ? (size / 1073741824).toFixed(2) + ' ГБ' : size >= 1048576 ? (size / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(size / 1024)) + ' КБ';
const dateText = day => day ? day.slice(8, 10) + '.' + day.slice(5, 7) + '.' + day.slice(0, 4) : 'Дата не указана';

function groupFiles(files) {
    const projects = new Map();
    for (const file of files) {
        const projectId = file.projectId || 'shared';
        if (!projects.has(projectId)) projects.set(projectId, {
            id: projectId,
            title: file.projectTitle || 'Общие файлы',
            tasks: new Map(),
            files: [],
        });
        const project = projects.get(projectId);
        project.files.push(file);
        const taskId = file.taskId || 'shared';
        if (!project.tasks.has(taskId)) project.tasks.set(taskId, {
            id: taskId,
            title: file.taskTitle || 'Общие файлы',
            date: file.workDate || null,
            assignee: file.assigneeName || '',
            files: [],
        });
        project.tasks.get(taskId).files.push(file);
    }
    return [...projects.values()].map(project => ({
        ...project,
        tasks: [...project.tasks.values()].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.title.localeCompare(b.title, 'ru')),
    })).sort((a, b) => a.id === 'shared' ? 1 : b.id === 'shared' ? -1 : a.title.localeCompare(b.title, 'ru'));
}

function FolderCard({ title, subtitle, count, size, onClick, icon }) {
    return <button type="button" onClick={onClick} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-white/15 bg-white/[0.05] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-400/10 focus-visible:outline-2 focus-visible:outline-violet-400">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-3xl">{icon || '📁'}</span>
        <span className="min-w-0 flex-1"><span className="block break-words text-base font-semibold text-white">{title}</span><span className="mt-1 block break-words text-xs leading-5 text-slate-400">{subtitle}</span><span className="mt-3 block text-xs font-medium text-violet-200">{count} файлов · {sizeText(size)}</span></span><span className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-violet-300" aria-hidden="true">→</span>
    </button>;
}

export default function EditorialShareLanding() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    const [projectId, setProjectId] = useState(null);
    const [taskId, setTaskId] = useState(null);
    const [query, setQuery] = useState('');
    useEffect(() => {
        let active = true;
        setData(null); setError(''); setProjectId(null); setTaskId(null); setPreview(null);
        fetch(BASE + '/editorial/library/public/' + encodeURIComponent(token))
            .then(async response => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Подборка недоступна');
                return body;
            })
            .then(body => { if (active) setData(body); })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [token]);

    useEffect(() => {
        if (!preview) return undefined;
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = e => { if (e.key === 'Escape') setPreview(null); };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = before; window.removeEventListener('keydown', onKey); };
    }, [preview]);

    const projects = useMemo(() => groupFiles(data?.files || []), [data]);
    const activeProject = projects.find(project => project.id === projectId);
    const activeTask = activeProject?.tasks.find(task => task.id === taskId);
    const search = query.trim().toLocaleLowerCase('ru');
    const searchResults = useMemo(() => !search ? null : (data?.files || []).filter(file => [
        file.name, file.caption, file.description, file.projectTitle, file.taskTitle, file.assigneeName,
    ].some(value => String(value || '').toLocaleLowerCase('ru').includes(search))), [data, search]);

    const listedFiles = searchResults || (activeTask ? activeTask.files : activeProject ? null : null);
    const fileUrl = file => BASE + '/editorial/library/public/' + encodeURIComponent(token) + '/files/' + encodeURIComponent(file.id);
    const archiveUrl = BASE + '/editorial/library/public/' + encodeURIComponent(token) + '/archive';
    const folderBytes = files => files.reduce((sum, file) => sum + (file.size || 0), 0);

    return <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-7">
            <header className="border-b border-white/15 pb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">MEDIA · РАФ · RAW</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Материалы редакции</h1><p className="mt-2 text-sm text-slate-400">Общий доступ к файлам редакционных проектов</p></div>
                    {data && data.files.length > 0 && <a href={archiveUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500">↓ Скачать всё ZIP</a>}
                </div>
            </header>
            {error && <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-5">{error}</div>}
            {!data && !error && <p role="status" className="rounded-xl border border-white/10 p-5 text-slate-300">Загружаем материалы…</p>}
            {data && <>
                <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-slate-900 p-5 sm:p-6">
                    <h2 className="text-xl font-bold sm:text-2xl">{data.share.title}</h2>
                    {data.share.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{data.share.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
                        <span>{projects.length} папок проектов</span><span>{data.files.length} файлов</span><span>{sizeText(folderBytes(data.files))}</span>
                        {data.share.expiresAt && <span>Доступ до {new Date(data.share.expiresAt).toLocaleDateString('ru-RU')}</span>}
                    </div>
                </section>
                <label className="block"><span className="sr-only">Поиск файлов, проектов и заданий</span>
                    <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти файл, проект, задание или исполнителя…" className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"/>
                </label>
                {!searchResults && <nav aria-label="Путь к файлам" className="flex flex-wrap items-center gap-2 text-sm">
                    <button type="button" onClick={() => { setProjectId(null); setTaskId(null); }} className={'rounded-lg px-3 py-2 ' + (!activeProject ? 'bg-violet-600 text-white' : 'border border-white/20 text-violet-200 hover:bg-white/10')}>Все проекты</button>
                    {activeProject && <><span className="text-slate-500">/</span><button type="button" onClick={() => setTaskId(null)} className={'max-w-full break-words rounded-lg px-3 py-2 ' + (!activeTask ? 'bg-violet-600 text-white' : 'border border-white/20 text-violet-200 hover:bg-white/10')}>{activeProject.title}</button></>}
                    {activeTask && <><span className="text-slate-500">/</span><span className="max-w-full break-words rounded-lg border border-white/20 px-3 py-2">{activeTask.title}</span></>}
                </nav>}
                {!searchResults && !activeProject && (projects.length ? <section className="space-y-3"><h3 className="text-lg font-semibold">Папки проектов</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map(project => <FolderCard key={project.id} icon="📁" title={project.title} subtitle={project.tasks.length + ' папок заданий'} count={project.files.length} size={folderBytes(project.files)} onClick={() => { setProjectId(project.id); setTaskId(null); }}/>)}
                </div></section> : <p className="rounded-xl border border-white/10 p-6 text-slate-400">В этой подборке пока нет доступных файлов.</p>)}
                {!searchResults && activeProject && !activeTask && <section className="space-y-3"><div><h3 className="text-lg font-semibold">Задания проекта</h3><p className="mt-1 text-sm text-slate-400">{activeProject.title}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {activeProject.tasks.map(task => <FolderCard key={task.id} icon="📂" title={task.title} subtitle={dateText(task.date) + (task.assignee ? ' · ' + task.assignee : '')} count={task.files.length} size={folderBytes(task.files)} onClick={() => setTaskId(task.id)}/>)}
                </div></section>}
                {listedFiles && <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><h3 className="text-lg font-semibold">{searchResults ? 'Результаты поиска' : 'Файлы задания'}</h3><span className="text-xs text-slate-400">{listedFiles.length} файлов · {sizeText(folderBytes(listedFiles))}</span></div>
                    {listedFiles.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {listedFiles.map(file => <article key={file.id} className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                            <button type="button" disabled={!media(file)} onClick={() => setPreview(file)} className="group flex h-44 w-full items-center justify-center overflow-hidden bg-slate-900 disabled:cursor-default">
                                {file.mimeType.startsWith('image/') ? <img loading="lazy" src={fileUrl(file)} alt={file.name} className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]" /> : <span className="text-5xl" aria-hidden="true">{file.mimeType.startsWith('video/') ? '🎬' : '📄'}</span>}
                            </button>
                            <div className="space-y-3 p-4"><h4 className="break-all text-sm font-semibold">{file.name}</h4>
                                <p className="text-xs text-slate-400">{sizeText(file.size)} · {new Date(file.createdAt).toLocaleDateString('ru-RU')}</p>
                                {searchResults && <p className="text-xs text-violet-200">{[file.projectTitle, file.taskTitle, file.assigneeName].filter(Boolean).join(' / ') || 'Общие файлы'}</p>}
                                {(file.caption || file.description) && <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-300">{file.caption || file.description}</p>}
                                <div className="flex flex-wrap gap-2">{media(file) && <button type="button" onClick={() => setPreview(file)} className="rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10">Просмотр</button>}<a href={fileUrl(file) + '?download=1'} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500">↓ Скачать</a></div>
                            </div>
                        </article>)}
                    </div> : <p className="rounded-xl border border-white/15 p-5 text-sm text-slate-400">Ничего не найдено. Попробуйте другой запрос.</p>}
                </section>}
            </>}
            {preview && <div role="dialog" aria-modal="true" aria-label={'Просмотр: ' + preview.name} className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4">
                <div className="mb-4 flex items-center justify-between gap-3"><h2 className="min-w-0 break-all text-sm">{preview.name}</h2><div className="flex shrink-0 gap-2"><a href={fileUrl(preview) + '?download=1'} className="rounded-lg border border-white/40 px-3 py-2 text-sm">Скачать</a><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-white/40 px-3 py-2 text-sm">Закрыть ✕</button></div></div>
                {preview.mimeType.startsWith('image/') ? <img src={fileUrl(preview)} alt={preview.name} className="min-h-0 flex-1 object-contain" /> : preview.mimeType.startsWith('video/') ? <video controls autoPlay src={fileUrl(preview)} className="min-h-0 flex-1" /> : <iframe title={preview.name} src={fileUrl(preview)} className="min-h-0 flex-1 bg-white" />}
            </div>}
        </div>
    </main>;
}
