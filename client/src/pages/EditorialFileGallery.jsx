import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
const filePath = id => '/editorial/library/files/' + encodeURIComponent(id);

function Preview({ file, token, onOpen }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        if (!file.mimeType?.startsWith('image/')) return undefined;
        let objectUrl = '';
        const controller = new AbortController();
        fetch(BASE + filePath(file.id) + '/thumbnail', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Нет превью'); return res.blob(); })
            .then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
            .catch(() => {});
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file.id, file.mimeType, token]);
    return <button type="button" onClick={onOpen} aria-label={'Просмотреть ' + file.name} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-violet-500/10 focus-visible:outline-2 focus-visible:outline-violet-400">
        {url ? <img src={url} alt={file.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform hover:scale-105" /> : <span className="text-4xl">{file.mimeType?.startsWith('video/') ? '🎬' : file.mimeType?.startsWith('image/') ? '🖼️' : '📄'}</span>}
    </button>;
}

function Viewer({ files, index, token, onClose, onNavigate, onUpdate, onError, downloadFile }) {
    const file = files[index];
    const [url, setUrl] = useState('');
    const [name, setName] = useState(file.name);
    const [description, setDescription] = useState(file.description || file.caption || '');
    const [saving, setSaving] = useState(false);
    useEffect(() => { setName(file.name); setDescription(file.description || file.caption || ''); }, [file.id, file.name, file.description, file.caption]);
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        const supported = file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/') || file.mimeType === 'application/pdf';
        if (supported) fetch(BASE + filePath(file.id), { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Не удалось открыть файл'); return res.blob(); })
            .then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
            .catch(error => { if (!controller.signal.aborted) onError(error.message); });
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file.id, file.mimeType, token]);
    useEffect(() => {
        const onKey = event => {
            if (event.key === 'Escape') onClose();
            if (['INPUT','TEXTAREA'].includes(event.target?.tagName)) return;
            if (event.key === 'ArrowLeft') onNavigate(-1);
            if (event.key === 'ArrowRight') onNavigate(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onNavigate]);
    async function save() {
        setSaving(true);
        try {
            await api(filePath(file.id), { token, method:'PATCH', body:{ name, description } });
            onUpdate(); onClose();
        } catch (error) { onError(error.message); }
        finally { setSaving(false); }
    }
    return <div role="dialog" aria-modal="true" aria-label={'Просмотр ' + file.name} className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 text-white sm:p-6">
        <header className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold">{file.name} · {index + 1} / {files.length}</span><button type="button" className="rounded-lg border border-white/40 px-3 py-2" onClick={onClose}>Закрыть ✕</button></header>
        <div className="my-3 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-black/30">
            {url && file.mimeType?.startsWith('image/') ? <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" /> :
                url && file.mimeType?.startsWith('video/') ? <video controls src={url} className="max-h-full max-w-full" /> :
                url && file.mimeType === 'application/pdf' ? <iframe title={file.name} src={url} className="h-full w-full bg-white" /> :
                <p className="p-6 text-center text-sm">{file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/') || file.mimeType === 'application/pdf' ? 'Загрузка предпросмотра…' : 'Предпросмотр этого формата недоступен'}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => onNavigate(-1)}>←</button><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => onNavigate(1)}>→</button></div><button type="button" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold" onClick={() => downloadFile(filePath(file.id), token, file.name).catch(e => onError(e.message))}>Скачать оригинал</button></div>
        {!file.source && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input aria-label="Название файла" value={name} onChange={e => setName(e.target.value)} maxLength={255} className="min-w-0 rounded-lg border border-white/30 bg-slate-800 p-2 text-white" /><input aria-label="Описание файла" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Добавить описание" className="min-w-0 rounded-lg border border-white/30 bg-slate-800 p-2 text-white" /><button type="button" disabled={saving || !name.trim()} onClick={save} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>}
    </div>;
}

export default function EditorialFileGallery({ files, token, view, selection, setSelection, onShare, onDelete, onUpdate, onError, downloadFile }) {
    const [index, setIndex] = useState(null);
    useEffect(() => { setIndex(null); }, [files.length, view]);
    const navigate = delta => setIndex(current => (current + delta + files.length) % files.length);
    return <>
        <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
            {files.map((file, i) => <article key={file.id} className={view === 'grid' ? 'min-w-0 rounded-xl border border-current/20 p-3' : 'flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-current/20 p-3'}>
                <div className={view === 'grid' ? 'mb-2' : 'w-24 shrink-0'}><Preview file={file} token={token} onOpen={() => setIndex(i)} /></div>
                <div className="min-w-0 flex-1"><h3 className="break-all font-semibold">{file.name}</h3><p className="my-1 text-xs opacity-80">{(file.size / 1048576).toFixed(2)} МБ · {new Date(file.createdAt).toLocaleDateString('ru-RU')}{file.taskTitle ? ' · ' + file.taskTitle : ''}{file.version ? ' · Версия ' + file.version : ''}</p>{(file.description || file.caption) && <p className="line-clamp-2 text-xs opacity-85">{file.description || file.caption}</p>}</div>
                <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selection.includes(file.id)} onChange={e => setSelection(items => e.target.checked ? [...items,file.id] : items.filter(id => id !== file.id))} /> Выбрать</label><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setIndex(i)}>Просмотр</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => downloadFile(filePath(file.id), token, file.name).catch(e => onError(e.message))}>Скачать</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => onShare(file)}>Общий доступ</button><button type="button" className="rounded-lg border border-rose-400/50 px-3 py-2 text-sm" onClick={() => onDelete(file)}>В корзину</button></div>
            </article>)}
        </div>
        {index !== null && files[index] && <Viewer files={files} index={index} token={token} onClose={() => setIndex(null)} onNavigate={navigate} onUpdate={onUpdate} onError={onError} downloadFile={downloadFile} />}
    </>;
}
