import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';

function CompareImage({ file, base, token }) {
    const [url, setUrl] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl;
        setUrl(null); setError('');
        (async () => {
            try {
                const response = await fetch(API + base + '/' + file.id + '/content', {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
                });
                if (!response.ok) throw new Error('Не удалось загрузить изображение');
                const blob = await response.blob();
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            } catch (e) {
                if (e.name !== 'AbortError') setError(e.message);
            }
        })();
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [base, file.id, token]);
    return <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-slate-950 p-2">
        {url ? <img src={url} alt={file.caption || file.name} className="max-h-full max-w-full object-contain" /> : <p className="text-sm text-slate-300">{error || 'Загрузка…'}</p>}
    </div>;
}

export default function EditorialMaterialCompare({ files, base, token, onClose }) {
    const [leftId, setLeftId] = useState(files[0]?.id || '');
    const [rightId, setRightId] = useState(files[1]?.id || '');
    const left = files.find(f => f.id === leftId);
    const right = files.find(f => f.id === rightId);
    useEffect(() => {
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const keydown = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', keydown);
        return () => { document.body.style.overflow = before; window.removeEventListener('keydown', keydown); };
    }, [onClose]);
    const options = files.map(file => <option key={file.id} value={file.id}>Версия {file.version} · {file.name}</option>);
    return createPortal(<div role="dialog" aria-modal="true" aria-label="Сравнение материалов" className="fixed inset-0 z-[10060] flex flex-col bg-slate-950 text-white">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-3 pt-[max(14px,env(safe-area-inset-top))]">
            <div className="min-w-0"><h3 className="font-semibold">Сравнение фотографий</h3><p className="text-xs text-slate-300">Выберите две фотографии или версии для сравнения</p></div>
            <button type="button" onClick={onClose} aria-label="Закрыть сравнение" className="shrink-0 rounded-lg border border-slate-500 bg-slate-800 px-4 py-2 font-semibold text-white">✕</button>
        </header>
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 overflow-hidden p-3 sm:grid-cols-2 sm:grid-rows-1">
            {[[left, leftId, setLeftId, 'Первое изображение'], [right, rightId, setRightId, 'Второе изображение']].map(([file, value, change, label]) =>
                <section key={label} className="flex min-h-0 min-w-0 flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">{label}
                        <select value={value} onChange={event => change(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-500 bg-slate-800 px-2 py-2 text-sm text-white">{options}</select>
                    </label>
                    {file && <CompareImage key={file.id} file={file} base={base} token={token} />}
                    <p className="line-clamp-2 text-xs text-slate-200">{file?.caption || 'Без подписи'}</p>
                </section>)}
        </div>
    </div>, document.body);
}
