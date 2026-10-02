import { useState } from 'react';
import { api } from '../../../../api/client.js';

export default function CategoryEditor({ token, initial, isNew, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: initial?.title || '',
        slug: initial?.slug || '',
        description: initial?.description || '',
        icon: initial?.icon || '📄',
        order: initial?.order ?? 0,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        setBusy(true); setError('');
        try {
            if (isNew) {
                await api('/admin/wiki/categories', { method: 'POST', token, body: form });
            } else {
                await api(`/admin/wiki/categories/${initial.id}`, { method: 'PATCH', token, body: form });
            }
            await onSaved();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-4" onClick={onClose}>
            <div className="card max-w-lg mx-auto my-8 p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{isNew ? 'Новая категория' : 'Редактирование категории'}</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>
                <input className="input mb-3" value={form.title} onChange={set('title')} placeholder="Название" />
                <input className="input mb-3 font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="slug (auto)" />
                <div className="grid grid-cols-[80px_1fr] gap-2 mb-3">
                    <input className="input text-center text-lg" value={form.icon} onChange={set('icon')} />
                    <input type="number" className="input" value={form.order} onChange={set('order')} />
                </div>
                <textarea rows={2} className="input resize-none mb-3" value={form.description} onChange={set('description')} placeholder="Описание" />
                {error && <p className="text-pink text-sm mb-3">{error}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={save} disabled={busy || !form.title} className="btn-primary">{busy ? '…' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    );
}