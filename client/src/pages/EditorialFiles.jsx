import { useEffect, useState } from 'react';
import EditorialFileGallery from './EditorialFileGallery.jsx';
import { uploadEditorialResumable } from './editorialResumableUpload.js';
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
    const [search, setSearch] = useState('');
    const [type, setType] = useState('all');
    const [sort, setSort] = useState('newest');
    const [bulkBusy, setBulkBusy] = useState(false);
    useEffect(() => { let active = true; api('/editorial/library/folders', { token }).then(data => { if (active) { setFiles(data.files); setFolders(data.folders); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token, refresh]);
    async function upload(event) {
        const chosen = Array.from(event.target.files || []);
        event.target.value = '';
        if (!chosen.length) return;
        setBusy(true); setError(''); setProgress(0);
        try {
            for (let index = 0; index < chosen.length; index++) {
                await uploadEditorialResumable({
                    path:'/editorial/library', file:chosen[index], token,
                    onProgress:percentage => setProgress(Math.round((index * 100 + percentage) / chosen.length)),
                });
            }
            setRefresh(n => n + 1);
        } catch (error) { setError(error.message); }
        finally { setBusy(false); setProgress(null); }
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
    const sourceFiles = folder ? (personFolder ? personFolder.files : []) : files;
    const visibleFiles = sourceFiles.filter(file => (type === 'all' || (type === 'image' ? file.mimeType?.startsWith('image/') : type === 'video' ? file.mimeType?.startsWith('video/') : !file.mimeType?.startsWith('image/') && !file.mimeType?.startsWith('video/'))) && (file.name + ' ' + (file.description || file.caption || '') + ' ' + (file.taskTitle || '')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name,'ru') : sort === 'size' ? b.size-a.size : new Date(b.createdAt)-new Date(a.createdAt));
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
        if (!window.confirm('Переместить «' + file.name + '» в корзину на 30 дней? Действующие материалы и общие ссылки защищены от удаления.')) return;
        try {
            const route = file.source === 'material' ? '/editorial/library/files/materials/' + encodeURIComponent(file.id.slice(9)) : '/editorial/library/files/' + encodeURIComponent(file.id);
            await api(route,{token,method:'DELETE'});
            setSelection(items => items.filter(id => id !== file.id));
            setRefresh(n => n + 1);
        } catch (error) { setError(error.message); }
    }
    async function removeSelected() {
        const targets = sourceFiles.filter(file => selection.includes(file.id));
        if (!targets.length) return;
        if (!window.confirm('Переместить ' + targets.length + ' выбранных файлов в корзину? Активные и опубликованные материалы останутся защищены.')) return;
        setBulkBusy(true); setError('');
        const failed = [];
        for (const file of targets) {
            const route = file.source === 'material' ? '/editorial/library/files/materials/' + encodeURIComponent(file.id.slice(9)) : '/editorial/library/files/' + encodeURIComponent(file.id);
            try {
                await api(route,{token,method:'DELETE'});
                setSelection(ids => ids.filter(id => id !== file.id));
            } catch (error) { failed.push(file.name + ': ' + error.message); }
        }
        setBulkBusy(false);
        setRefresh(n => n + 1);
        if (failed.length) setError('Не удалось удалить ' + failed.length + ' из ' + targets.length + ' файлов. ' + failed.slice(0,3).join('; '));
    }
    async function removeFolder(item) {
        if (!window.confirm('Убрать пустую завершённую папку «' + item.title + '» из файлового менеджера? Сам проект и его история сохранятся.')) return;
        try {
            await api('/editorial/library/folders/projects/' + encodeURIComponent(item.id),{token,method:'DELETE'});
            setFolder(null); setPersonFolder(null);
            setRefresh(n => n + 1);
        } catch (error) { setError(error.message); }
    }
    return <div className="editorial-workspace-content space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Файлы редакции</h2><p className="text-sm opacity-70">Закрытое хранилище для передачи материалов другим подразделениям.</p></div><label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">+ Загрузить файл<input type="file" multiple className="sr-only" onChange={upload} disabled={busy} /></label></div>
        {progress !== null && <div role="status" className="space-y-1 text-sm"><span>Загрузка: {progress}%</span><progress max="100" value={progress} className="block w-full" /></div>}
        {error && <p role="alert" className="rounded-lg border border-red-500 p-3">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm"><button className="underline" onClick={() => { setFolder(null); setPersonFolder(null); }}>Все файлы</button>{folder && <><span> / </span><button className="underline" onClick={() => setPersonFolder(null)}>{folder.title}</button></>}{personFolder && <span> / {personFolder.title}</span>}</div>
            <div className="flex rounded-lg border border-current/20 p-1" role="group" aria-label="Вид файлов"><button aria-pressed={view === 'grid'} className={`rounded px-3 py-2 text-sm ${view === 'grid' ? 'bg-violet-600 text-white' : ''}`} onClick={() => changeView('grid')}>▦ Значки</button><button aria-pressed={view === 'list'} className={`rounded px-3 py-2 text-sm ${view === 'list' ? 'bg-violet-600 text-white' : ''}`} onClick={() => changeView('list')}>☷ Список</button></div>
        </div>
        {!folder && <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
            {folders.map(item => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-current/20 p-4"><button className="min-w-0 flex-1 text-left" onClick={() => { setFolder(item); setPersonFolder(null); }}><span className="mr-2 text-xl">📁</span><span className="font-semibold">{item.title}</span><span className="block text-xs opacity-60">{item.files.length} файлов</span></button><div className="flex flex-wrap gap-2"><button disabled={!item.files.length} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={() => share(item, item.id)}>Общий доступ</button><button type="button" className="rounded-lg border border-rose-400/60 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" onClick={() => removeFolder(item)}>Удалить папку</button></div></article>)}
        </div>}
        {folder && !personFolder && <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
            {(folder.folders || []).map(group => <article key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-current/20 p-4"><button className="min-w-0 flex-1 text-left" onClick={() => setPersonFolder(group)}><span className="mr-2 text-xl">📁</span><span className="font-semibold">{group.title}</span><span className="block text-xs opacity-60">{group.files.length} файлов</span></button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => sharePerson(group)}>Общий доступ</button></article>)}
        </div>}
        {!folder && <h3 className="font-semibold">Общие файлы</h3>}
        <div className="grid gap-2 rounded-xl border border-current/15 bg-violet-500/5 p-3 sm:grid-cols-[1fr_auto_auto]">
            <input aria-label="Поиск файлов" placeholder="Поиск по названию, описанию или заданию…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 rounded-lg border border-current/25 bg-transparent px-3 py-2 text-sm" />
            <select aria-label="Тип файла" value={type} onChange={event => setType(event.target.value)} className="rounded-lg border border-current/25 bg-transparent px-3 py-2 text-sm"><option value="all">Все типы</option><option value="image">Фотографии</option><option value="video">Видео</option><option value="other">Документы</option></select>
            <select aria-label="Сортировка файлов" value={sort} onChange={event => setSort(event.target.value)} className="rounded-lg border border-current/25 bg-transparent px-3 py-2 text-sm"><option value="newest">Сначала новые</option><option value="name">По имени</option><option value="size">По размеру</option></select>
            <p className="sm:col-span-3 text-xs opacity-75">Показано: {visibleFiles.length} из {sourceFiles.length} · Объём: {(visibleFiles.reduce((sum,file) => sum + file.size,0) / 1048576).toFixed(1)} МБ · Удалённые файлы доступны для восстановления из корзины администратора в течение 30 дней.</p>
        </div>
        {visibleFiles.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 p-3"><span className="text-sm font-semibold">Подборка · {selection.length} выбрано</span><button type="button" onClick={() => setSelection(visibleFiles.map(file => file.id))} className="rounded-lg border border-current/20 px-2 py-1 text-xs">Выбрать все</button><button type="button" onClick={() => setSelection([])} className="rounded-lg border border-current/20 px-2 py-1 text-xs">Снять выбор</button><button type="button" disabled={!selection.length || bulkBusy} onClick={removeSelected} className="rounded-lg border border-rose-400/60 px-2 py-1 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-200">{bulkBusy ? 'Удаляем…' : 'В корзину выбранное'}</button><input value={collectionTitle} onChange={e => setCollectionTitle(e.target.value)} placeholder="Название подборки" maxLength={160} aria-label="Название подборки" className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent p-2 text-sm" /><button type="button" disabled={!selection.length || !collectionTitle.trim() || sharing} onClick={shareSelection} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Создать общую ссылку</button></div>}
        <EditorialFileGallery files={visibleFiles} token={token} view={view} selection={selection} setSelection={setSelection} onShare={share} onDelete={remove} onUpdate={() => setRefresh(n => n + 1)} onError={setError} downloadFile={downloadEditorialFile} />
        {folder && !(folder.folders || []).length && <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70">В проекте пока нет загруженных материалов.</p>}
        {!folder && !files.length && !folders.length && !error && <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70">Здесь пока нет файлов и проектов.</p>}
    </div>;
}
