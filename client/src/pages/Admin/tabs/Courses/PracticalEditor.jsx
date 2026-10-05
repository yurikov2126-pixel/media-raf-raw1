import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';

export default function PracticalEditor({
                                            lessonId,
                                            practical,
                                            setPractical,
                                            token,
                                            onChanged,
                                        }) {
    const [form, setForm] = useState({
        topic: practical?.topic || '',
        description: practical?.description || '',
        location: practical?.location || '',
        scheduledAt: practical?.scheduledAt
            ? new Date(practical.scheduledAt).toISOString().slice(0, 16)
            : '',
        durationMin: practical?.durationMin ?? 90,
        supervisorId: practical?.supervisorId || '',
    });
    const [mentors, setMentors] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api('/admin/mentors', { token })
            .then(setMentors)
            .catch(() => setMentors([]));
    }, [token]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        if (!form.topic.trim() || !form.description.trim()) {
            setError('Заполните тему и описание');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const payload = {
                topic: form.topic,
                description: form.description,
                location: form.location || null,
                scheduledAt: form.scheduledAt
                    ? new Date(form.scheduledAt).toISOString()
                    : null,
                durationMin: Number(form.durationMin) || 90,
                supervisorId: form.supervisorId || null,
            };
            const saved = practical
                ? await api(`/admin/practicals/${practical.id}`, {
                    method: 'PATCH',
                    token,
                    body: payload,
                })
                : await api(`/admin/lessons/${lessonId}/practical`, {
                    method: 'POST',
                    token,
                    body: payload,
                });
            setPractical(saved);
            onChanged?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!practical) return;
        if (!confirm('Удалить практику?')) return;
        try {
            await api(`/admin/practicals/${practical.id}`, {
                method: 'DELETE',
                token,
            });
            setPractical(null);
            onChanged?.();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="space-y-2">
            <div className="text-sm font-bold mb-1">
                🎯 Практика {practical ? '(создана)' : '(нет)'}
            </div>
            {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    {error}
                </div>
            )}
            <input
                className="input"
                value={form.topic}
                onChange={set('topic')}
                placeholder="Тема занятия"
            />
            <textarea
                rows={5}
                className="input resize-none text-sm"
                value={form.description}
                onChange={set('description')}
                placeholder="Что делаем на занятии"
            />
            <input
                className="input"
                value={form.location}
                onChange={set('location')}
                placeholder="Аудитория / онлайн"
            />
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="datetime-local"
                    className="input"
                    value={form.scheduledAt}
                    onChange={set('scheduledAt')}
                />
                <input
                    type="number"
                    className="input"
                    value={form.durationMin}
                    onChange={set('durationMin')}
                    placeholder="Длительность, мин"
                />
            </div>
            <select
                className="input"
                value={form.supervisorId}
                onChange={set('supervisorId')}
            >
                <option value="">— руководитель не назначен —</option>
                {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role})
                    </option>
                ))}
            </select>
            <div className="flex gap-2">
                <button
                    onClick={save}
                    disabled={busy}
                    className="btn-primary text-sm disabled:opacity-40"
                >
                    {busy ? 'Сохранение…' : practical ? 'Сохранить' : 'Создать практику'}
                </button>
                {practical && (
                    <button
                        onClick={remove}
                        className="btn-ghost text-sm hover:text-red-400"
                    >
                        Удалить
                    </button>
                )}
            </div>
        </div>
    );
}