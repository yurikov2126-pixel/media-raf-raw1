import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';

export default function WikiModeration({ token, onClose }) {
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const load = async () => {
        try { setItems(await api('/admin/wiki/proposals', { token })); }
        catch (e) { setError(e.message); }
    };
    useEffect(() => { load(); }, [token]);
    const review = async (id, status) => {
        setBusy(id); setError('');
        try {
            await api('/admin/wiki/proposals/' + id + '/review', { method: 'POST', token, body: { status } });
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(''); }
    };
    return <div className="fixed inset-0 z-[110] bg-black/75 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Предложения правок">
        <div className="card max-w-4xl mx-auto p-5 space-y-4">
            <div className="flex justify-between items-center gap-2"><h2 className="font-bold text-xl">Предложения правок</h2><button className="btn-ghost" onClick={onClose}>✕ Закрыть</button></div>
            {error && <p role="alert" className="text-pink">{error}</p>}
            {!items.length && <p className="text-white/60">Нет предложений, ожидающих проверки.</p>}
            {items.map(item => <div key={item.id} className="border border-white/10 rounded-xl p-4 space-y-3">
                <div className="font-semibold">{item.article?.title || 'Статья удалена'}</div>
                {item.note && <p className="text-white/70 text-sm">{item.note}</p>}
                <details><summary className="text-sm cursor-pointer text-violet-soft">Просмотреть предложенную редакцию</summary>
                    <pre className="overflow-auto max-h-72 whitespace-pre-wrap break-words text-xs bg-white/5 p-3 rounded-xl mt-2">{item.content}</pre>
                </details>
                <div className="flex flex-wrap justify-end gap-2">
                    <button className="btn-ghost" disabled={!!busy} onClick={() => review(item.id, 'REJECTED')}>Отклонить</button>
                    <button className="btn-primary" disabled={!!busy || !item.article} onClick={() => review(item.id, 'APPROVED')}>Принять</button>
                </div>
            </div>)}
        </div>
    </div>;
}
