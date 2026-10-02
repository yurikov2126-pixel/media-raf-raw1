import { useState } from 'react';
import { api } from '../../../api/client.js';
import SearchSelect from '../components/SearchSelect.jsx';

export default function Certificates({ certificates, setCertificates, users, courses, token }) {
    const [filter, setFilter] = useState('');
    const [creating, setCreating] = useState(false);

    const reload = async () => {
        const list = await api('/admin/certificates', { token });
        setCertificates(list);
    };

    const update = async (id, patch) => {
        const c = await api(`/admin/certificates/${id}`, { method: 'PATCH', token, body: patch });
        setCertificates((prev) => prev.map((x) => (x.id === id ? { ...x, ...c } : x)));
    };

    const remove = async (id) => {
        if (!confirm('Удалить сертификат?')) return;
        await api(`/admin/certificates/${id}`, { method: 'DELETE', token });
        setCertificates((prev) => prev.filter((x) => x.id !== id));
    };

    const filtered = certificates.filter((c) => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
            c.user.fullName.toLowerCase().includes(q) ||
            c.user.username.toLowerCase().includes(q) ||
            c.serial.toLowerCase().includes(q) ||
            c.course.title.toLowerCase().includes(q)
        );
    });

    return (
        <div>
            <div className="flex gap-2 mb-4 flex-wrap">
                <input className="input flex-1 min-w-[220px]" placeholder="Поиск…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <button onClick={() => setCreating(true)} className="btn-primary">＋ Выдать сертификат</button>
            </div>
            <div className="card divide-y divide-white/5">
                {filtered.map((c) => (
                    <CertificateRow key={c.id} cert={c} onUpdate={update} onDelete={remove} />
                ))}
                {filtered.length === 0 && (
                    <div className="p-6 text-center text-white/40">
                        {filter ? 'Ничего не найдено' : 'Сертификатов пока нет'}
                    </div>
                )}
            </div>
            {creating && (
                <CreateModal
                    users={users}
                    courses={courses}
                    token={token}
                    onClose={() => setCreating(false)}
                    onCreated={async () => { setCreating(false); await reload(); }}
                />
            )}
        </div>
    );
}

function CreateModal({ users, courses, token, onClose, onCreated }) {
    const [userId, setUserId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError('');
        if (!userId || !courseId) { setError('Выберите студента и курс'); return; }
        setBusy(true);
        try {
            await api('/admin/certificates', { method: 'POST', token, body: { userId, courseId } });
            await onCreated();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-4" onClick={onClose}>
            <div className="card max-w-lg mx-auto my-8 p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Выдать сертификат</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>
                <label className="text-xs text-white/40 uppercase mb-1 block">Студент</label>
                <SearchSelect
                    items={users.map((u) => ({ id: u.id, label: u.fullName, sub: `@${u.username} · ${u.phone}` }))}
                    value={userId}
                    onChange={setUserId}
                    placeholder="Начните вводить имя…"
                />
                <label className="text-xs text-white/40 uppercase mb-1 mt-4 block">Курс</label>
                <SearchSelect
                    items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                    value={courseId}
                    onChange={setCourseId}
                    placeholder="Начните вводить название…"
                />
                {error && <p className="text-pink text-sm mt-3">{error}</p>}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={submit} disabled={busy} className="btn-primary">
                        {busy ? 'Выдача…' : 'Выдать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CertificateRow({ cert, onUpdate, onDelete }) {
    const [open, setOpen] = useState(false);
    const [serial, setSerial] = useState(cert.serial);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try { await onUpdate(cert.id, { serial }); setOpen(false); }
        finally { setSaving(false); }
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="text-2xl">🏆</div>
                <div className="flex-1 min-w-[200px]">
                    <div className="font-bold">{cert.user.fullName}</div>
                    <div className="text-xs text-white/40">{cert.course.title} · {serial}</div>
                </div>
                <div className="text-xs text-white/40">{new Date(cert.issuedAt).toLocaleDateString('ru-RU')}</div>
                <button onClick={() => setOpen((o) => !o)} className="chip bg-white/5 text-xs">{open ? 'Скрыть' : '✏️'}</button>
                <button onClick={() => onDelete(cert.id)} className="chip bg-white/5 hover:bg-pink/30 text-xs">🗑️</button>
            </div>
            {open && (
                <div className="grid md:grid-cols-2 gap-2 mt-3">
                    <input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Серийный номер" />
                    <button onClick={save} disabled={saving} className="btn-primary">{saving ? '…' : 'Сохранить'}</button>
                </div>
            )}
        </div>
    );
}