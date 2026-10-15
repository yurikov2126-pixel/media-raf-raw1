import { useState } from 'react';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';

async function sendImport(path, file, token, mode) {
    const fd = new FormData();
    fd.append('archive', file);
    if (mode) fd.append('mode', mode);
    const response = await fetch(BASE + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Ошибка импорта');
    return result;
}

export default function WikiImport({ token, onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [mode, setMode] = useState('create');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const analyze = async (selected) => {
        setFile(selected); setPreview(null); setError('');
        if (!selected) return;
        if (!selected.name.toLowerCase().endsWith('.zip')) { setError('Выберите ZIP-архив'); return; }
        setBusy(true);
        try { setPreview(await sendImport('/admin/wiki/import/preview', selected, token)); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const importAll = async () => {
        if (!preview || !file) return;
        if (mode === 'replace' && !window.confirm('Существующие статьи с тем же slug будут перезаписаны. Продолжить?')) return;
        setBusy(true); setError('');
        try {
            const result = await sendImport('/admin/wiki/import', file, token, mode);
            await onImported(result);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Импорт статей ВикиМедиа">
            <div className="card max-w-2xl mx-auto my-6 p-5 sm:p-7 space-y-5">
                <div className="flex justify-between gap-3 items-start">
                    <div><h2 className="font-bold text-xl">Импорт статей с иллюстрациями</h2>
                        <p className="text-sm text-white/60 mt-1">Загрузите ZIP с manifest.json, articles/*.md и assets/.</p></div>
                    <button onClick={onClose} aria-label="Закрыть" className="btn-ghost">✕</button>
                </div>
                <label className="block border border-dashed border-white/20 rounded-xl p-5 cursor-pointer text-center hover:border-violet/60">
                    <span className="block font-medium">{file ? file.name : 'Выбрать ZIP-архив'}</span>
                    <span className="text-xs opacity-60">До 45 МБ · PNG, JPG, WebP · автоматически проверяется структура</span>
                    <input className="sr-only" type="file" accept=".zip,application/zip" disabled={busy}
                        onChange={(e) => analyze(e.target.files?.[0] || null)} />
                </label>
                {error && <div role="alert" className="text-sm text-pink bg-pink/10 rounded-lg p-3">{error}</div>}
                {busy && <p role="status" className="text-sm">Проверяем архив…</p>}
                {preview && <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/5 p-3"><b>{preview.categories}</b><div className="text-xs opacity-60">категорий</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><b>{preview.articles.length}</b><div className="text-xs opacity-60">статей</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><b>{preview.images}</b><div className="text-xs opacity-60">иллюстраций</div></div>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-xl border border-white/10 divide-y divide-white/10">
                        {preview.articles.map((a) => <div key={a.slug} className="p-3 flex justify-between gap-3 text-sm">
                            <div className="min-w-0"><div className="font-semibold break-words">{a.title}</div><div className="opacity-60 text-xs">{a.images} изображений</div></div>
                            <span className="shrink-0 text-xs opacity-60">{a.action === 'create' ? 'Новая' : 'Существует'}</span>
                        </div>)}
                    </div>
                    <fieldset className="space-y-2 text-sm">
                        <legend className="font-semibold mb-2">Режим импорта</legend>
                        <label className="flex items-start gap-2"><input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} /><span>Только новые (существующие статьи не менять)</span></label>
                        <label className="flex items-start gap-2"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /><span>Заменить существующие по slug (требует подтверждения)</span></label>
                    </fieldset>
                </>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={importAll} disabled={!preview || busy} className="btn-primary">Импортировать</button>
                </div>
            </div>
        </div>
    );
}
