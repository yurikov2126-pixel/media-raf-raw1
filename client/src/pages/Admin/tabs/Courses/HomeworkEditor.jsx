import { useState } from 'react';
import { api } from '../../../../api/client.js';

export default function HomeworkEditor({
                                           lessonId,
                                           homework,
                                           setHomework,
                                           token,
                                           onChanged,
                                       }) {
    const [form, setForm] = useState({
        title: homework?.title || '',
        description: homework?.description || '',
        maxFiles: homework?.maxFiles ?? 3,
        maxFileSizeMb: homework?.maxFileSizeMb ?? 50,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        if (!form.title.trim() || !form.description.trim()) {
            setError('Заполните название и описание');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const payload = {
                title: form.title,
                description: form.description,
                maxFiles: Number(form.maxFiles) || 3,
                maxFileSizeMb: Number(form.maxFileSizeMb) || 50,
            };
            const saved = homework
                ? await api(`/admin/homework/${homework.id}`, {
                    method: 'PATCH',
                    token,
                    body: payload,
                })
                : await api(`/admin/lessons/${lessonId}/homework`, {
                    method: 'POST',
                    token,
                    body: payload,
                });
            setHomework(saved);
            onChanged?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!homework) return;
        if (!confirm('Удалить ДЗ?')) return;
        try {
            await api(`/admin/homework/${homework.id}`, {
                method: 'DELETE',
                token,
            });
            setHomework(null);
            onChanged?.();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="space-y-2">
            <div className="text-sm font-bold mb-1">
                📋 Домашнее задание {homework ? '(создано)' : '(нет)'}
            </div>
            {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    {error}
                </div>
            )}
            <input
                className="input"
                value={form.title}
                onChange={set('title')}
                placeholder="Название ДЗ"
            />
            <textarea
                rows={6}
                className="input resize-none text-sm"
                value={form.description}
                onChange={set('description')}
                placeholder="Описание задания (поддерживается markdown)"
            />
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="number"
                    min="1"
                    max="20"
                    className="input"
                    value={form.maxFiles}
                    onChange={set('maxFiles')}
                    placeholder="Макс. файлов"
                />
                <input
                    type="number"
                    min="1"
                    max="500"
                    className="input"
                    value={form.maxFileSizeMb}
                    onChange={set('maxFileSizeMb')}
                    placeholder="Макс. размер, МБ"
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={save}
                    disabled={busy}
                    className="btn-primary text-sm disabled:opacity-40"
                >
                    {busy ? 'Сохранение…' : homework ? 'Сохранить' : 'Создать ДЗ'}
                </button>
                {homework && (
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