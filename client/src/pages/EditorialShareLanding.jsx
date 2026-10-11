import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
const media = file => file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf';
export default function EditorialShareLanding() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    useEffect(() => { let active = true; fetch(BASE + '/editorial/library/public/' + encodeURIComponent(token)).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Подборка недоступна'); return body; }).then(body => { if (active) setData(body); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token]);
    const fileUrl = file => BASE + '/editorial/library/public/' + encodeURIComponent(token) + '/files/' + encodeURIComponent(file.id);
    return <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl space-y-7">
        <header className="border-b border-white/15 pb-6"><p className="text-xs font-bold uppercase tracking-widest text-violet-300">MEDIA · РАФ · RAW</p><h1 className="mt-3 text-3xl font-bold">Материалы редакции</h1><p className="mt-2 text-sm text-slate-400">Обмен материалами с коллегами</p></header>
        {error && <div role="alert" className="rounded-xl border border-rose-500/50 p-5">{error}</div>}
        {!data && !error && <p role="status">Загружаем подборку…</p>}
        {data && <><section className="space-y-3"><h2 className="text-2xl font-semibold">{data.share.title}</h2>{data.share.description && <p className="whitespace-pre-wrap text-slate-300">{data.share.description}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Файлов: {data.files.length}{data.share.expiresAt ? ' · Доступно до ' + new Date(data.share.expiresAt).toLocaleDateString('ru-RU') : ''}</p><a href={BASE + '/editorial/library/public/' + encodeURIComponent(token) + '/archive'} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500">Скачать всё ZIP ↓</a></div></section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.files.map(file => <article key={file.id} className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
            <div className="flex h-44 items-center justify-center bg-slate-900">{file.mimeType.startsWith('image/') ? <img loading="lazy" src={fileUrl(file)} alt={file.name} className="h-full w-full object-contain" /> : <span className="text-5xl">{file.mimeType.startsWith('video/') ? '🎬' : '📄'}</span>}</div>
            <div className="space-y-3 p-4"><h3 className="break-all font-semibold">{file.name}</h3><p className="text-xs text-slate-400">{(file.size / 1048576).toFixed(2)} МБ</p><div className="flex flex-wrap gap-2">{media(file) && <button onClick={() => setPreview(file)} className="rounded-lg border border-white/30 px-3 py-2 text-sm">Просмотр</button>}<a href={fileUrl(file) + '?download=1'} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold">Скачать ↓</a></div></div>
        </article>)}</div></>}
        {preview && <div role="dialog" aria-modal="true" aria-label={'Просмотр: ' + preview.name} className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="break-all text-sm">{preview.name}</h2><button onClick={() => setPreview(null)} className="rounded-lg border px-4 py-2">Закрыть ✕</button></div>{preview.mimeType.startsWith('image/') ? <img src={fileUrl(preview)} alt={preview.name} className="min-h-0 flex-1 object-contain" /> : preview.mimeType.startsWith('video/') ? <video controls autoPlay src={fileUrl(preview)} className="min-h-0 flex-1" /> : <iframe title={preview.name} src={fileUrl(preview)} className="min-h-0 flex-1 bg-white" />}</div>}
    </div></main>;
}
