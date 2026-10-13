import { useEffect, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const labels = { PENDING: 'На проверке', REJECTED: 'Доработка', APPROVED: 'Принято' };
const parseFiles = (value) => { try { return JSON.parse(value || '[]'); } catch { return []; } };
export default function HomeworkHistory({ submissionId }) {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [compare, setCompare] = useState(false);
    useEffect(() => {
        if (!open || !submissionId) return;
        let live = true;
        setBusy(true);
        api(`/homework/submissions/${encodeURIComponent(submissionId)}/history`, { token })
            .then((data) => { if (live) setItems(data); })
            .catch((e) => { if (live) setError(e.message || 'Ошибка истории'); })
            .finally(() => { if (live) setBusy(false); });
        return () => { live = false; };
    }, [open, submissionId, token]);
    return <section className="mt-3">
        <button type="button" className="btn-ghost text-sm min-h-10" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Скрыть историю ↑' : '🕘 История версий работы'}
        </button>
        {open && <div className="mt-3 space-y-3">
            {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
            {busy && <p role="status" className="text-white/65 text-sm">Загружаем версии…</p>}
            {items.length > 1 && <button type="button" className="text-sm text-violet-soft" onClick={() => setCompare(!compare)}>
                {compare ? 'Показать всю историю' : 'Сравнить последние две версии'}
            </button>}
            <div className={compare ? 'grid md:grid-cols-2 gap-3' : 'space-y-3'}>
                {(compare ? items.slice(0, 2) : items).map(v => <article key={v.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                        <strong className="text-sm">Версия №{v.version}</strong>
                        <span className="text-xs text-white/65">{labels[v.status] || v.status}</span>
                    </div>
                    <div className="text-xs text-white/55">{new Date(v.submittedAt).toLocaleString('ru-RU')}</div>
                    {v.text && <p className="whitespace-pre-wrap break-words text-sm text-white/85">{v.text}</p>}
                    {v.link && <a className="block text-sm text-violet-soft break-all" href={v.link} target="_blank" rel="noreferrer">Ссылка на материал ↗</a>}
                    {parseFiles(v.files).length > 0 && <div className="flex gap-2 flex-wrap">{parseFiles(v.files).map((f,i)=>
                        <a key={i} className="text-xs rounded-lg bg-white/10 px-3 py-2 break-all hover:bg-white/15"
                           href={resolveUrl(f.url)} target="_blank" rel="noreferrer">📎 {f.name || 'Файл'}</a>)}</div>}
                    {v.grade != null && <p className="text-xs">Оценка: {v.finalGrade ?? v.grade}/5</p>}
                    {v.feedback && <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-sm whitespace-pre-wrap">{v.feedback}</div>}
                </article>)}
            </div>
        </div>}
    </section>;
}
