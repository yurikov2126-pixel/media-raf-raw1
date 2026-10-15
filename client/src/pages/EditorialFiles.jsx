import { useEffect, useState } from 'react';
import EditorialFileGallery from './EditorialFileGallery.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
export async function downloadEditorialFile(path, token, name) {
    const response = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Не удалось скачать файл');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function EditorialFiles() {
    const { token } = useAuth();
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [folder, setFolder] = useState(null);
    const [personFolder, setPersonFolder] = useState(null);
    const [view, setView] = useState(() => localStorage.getItem('editorial-files-view') || 'grid');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const [selection, setSelection] = useState([]);
    const [collectionTitle, setCollectionTitle] = useState('');
    const [sharing, setSharing] = useState(false);
    useEffect(() => { let active = true; api('/editorial/library/folders', { token }).then(data => { if (active) { setFiles(data.files); setFolders(data.folders); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token, refresh]);
    function upload(event) {
        const selected = event.target.files?.[0];
        if (!selected) return;
        setBusy(true); setError(''); setProgress(0);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', BASE + '/editorial/library/files');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => { setBusy(false); setProgress(null); if (xhr.status >= 200 && xhr.status < 300) setRefresh(n => n + 1); else { try { setError(JSON.parse(xhr.responseText).error || 'Ошибка загрузки'); } catch { setError('Ошибка загрузки'); } } };
        xhr.onerror = () => { setBusy(false); setProgress(null); setError('Сетевая ошибка'); };
        const form = new FormData(); form.append('file', selected); xhr.send(form);
        event.target.value = '';
    }
    async function share(item, projectId = null) {
        setError('');
        try {
            const { share } = await api('/editorial/library/shares/quick', { token, method: 'POST', body: projectId ? { projectId } : { fileId: item.id } });
            const url = window.location.origin + '/share/editorial/' + share.token;
            try { await navigator.clipboard.writeText(url); window.alert('Ссылка создана и скопирована: ' + url); }
            catch { window.prompt('Ссылка создана. Скопируйте её:', url); }
        } catch (e) { setError(e.message); }
    }
    async function sharePerson(group) {
        setError('');
        try {
            const { share: link } = await api('/editorial/library/shares', { token, method: 'POST', body: { title: folder.title + ' / ' + group.title, fileIds: group.files.map(file => file.id), expiresInDays: 30 } });
            const url = window.location.origin + '/share/editorial/' + link.token;
            try { await navigator.clipboard.writeText(url); window.alert('Ссылка скопирована: ' + url); }
            catch { window.prompt('Скопируйте ссылку:', url); }
        } catch (e) { setError(e.message); }
    }
    const visibleFiles = folder ? (personFolder ? personFolder.files : []) : files;
    async function shareSelection() {
        if (!selection.length || !collectionTitle.trim()) return;
        setSharing(true); setError('');
        try {
            const { share: link } = await api('/editorial/library/shares', { token, method:'POST', body:{ title:collectionTitle.trim(), fileIds:selection, expiresInDays:30 } });
            setSelection([]); setCollectionTitle('');
            const url = window.location.origin + '/share/editorial/' + link.token;
            try { await navigator.clipboard.writeText(url); window.alert('Ссылка скопирована: ' + url); }
            catch { window.prompt('Скопируйте ссылку:', url); }
        } catch (e) { setError(e.message); }
        finally { setSharing(false); }
    }
    function changeView(next) { setView(next); localStorage.setItem('editorial-files-view', next); }
    async function remove(file) {
        if (!window.confirm('Удалить файл «' + file.name + '»? Он также исчезнет из общих ссылок.')) return;
        try { await api('/editorial/library/files/' + file.id, { token, method: 'DELETE' }); setRefresh(n => n + 1); }
        catch (e) { setError(e.message); }
    }
    return <div className="editorial-workspace-content space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Файлы редакции</h2><p className="text-sm opacity-70">Закрытое хранилище для передачи материалов другим подразделениям.</p></div><label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">+ Загрузить файл<input type="file" className="sr-only" onChange={upload} disabled={busy} /></label></div>
        {progress !== null && <div role="status" className="space-y-1 text-sm"><span>Загрузка: {progress}%</span><progress max="100" value={progress} className="block w-full" /></div>}
        {error && <p role="alert" className="rounded-lg border border-red-500 p-3">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm"><button className="underline" onClick={() => { setFolder(null); setPersonFolder(null); }}>Все файлы</button>{folder && <><span> / </span><button className="underline" onClick={() => setPersonFolder(null)}>{folder.title}</button></>}{personFolder && <span> / {personFolder.title}</span>}</div>
            <div className="flex rounded-lg border border-current/20 p-1" role="group" aria-label="Вид файлов"><button aria-pressed={view === 'grid'} className={`rounded px-3 py-2 text-sm ${view === 'grid' ? 'bg-violet-600 text-white' : ''}`} onClick={() => changeView('grid')}>▦ Значки</button><button aria-pressed={view === 'list'} className={`rounded px-3 py-2 text-sm ${view === 'list' ? 'bg-violet-600 text-white' : ''}`} onClick={() => changeView('list')}>☷ Список</button></div>
        </div>
        {!folder && <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
            {folders.map(item => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-current/20 p-4"><button className="min-w-0 flex-1 text-left" onClick={() => { setFolder(item); setPersonFolder(null); }}><span className="mr-2 text-xl">📁</span><span className="font-semibold">{item.title}</span><span className="block text-xs opacity-60">{item.files.length} файлов</span></button><button disabled={!item.files.length} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={() => share(item, item.id)}>Общий доступ</button></article>)}
        </div>}
        {folder && !personFolder && <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
            {(folder.folders || []).map(group => <article key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-current/20 p-4"><button className="min-w-0 flex-1 text-left" onClick={() => setPersonFolder(group)}><span className="mr-2 text-xl">📁</span><span className="font-semibold">{group.title}</span><span className="block text-xs opacity-60">{group.files.length} файлов</span></button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => sharePerson(group)}>Общий доступ</button></article>)}
        </div>}
        {!folder && <h3 className="font-semibold">Общие файлы</h3>}
        {visibleFiles.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 p-3"><span className="text-sm font-semibold">Подборка · {selection.length} выбрано</span><input value={collectionTitle} onChange={e => setCollectionTitle(e.target.value)} placeholder="Название подборки" maxLength={160} aria-label="Название подборки" className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent p-2 text-sm" /><button type="button" disabled={!selection.length || !collectionTitle.trim() || sharing} onClick={shareSelection} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Создать общую ссылку</button></div>}
        <EditorialFileGallery files={visibleFiles} token={token} view={view} selection={selection} setSelection={setSelection} onShare={share} onDelete={remove} onUpdate={() => setRefresh(n => n + 1)} onError={setError} downloadFile={downloadEditorialFile} />
        {folder && !(folder.folders || []).length && <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70">В проекте пока нет загруженных материалов.</p>}
        {!folder && !files.length && !folders.length && !error && <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70">Здесь пока нет файлов и проектов.</p>}
    </div>;
}
