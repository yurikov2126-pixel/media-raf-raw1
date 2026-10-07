import { useState } from 'react';
import { api } from '../../../../api/client.js';
import { useToast } from '../../../../store/toast.jsx';

function toLocalInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HomeworkEditor({
                                           lessonId,
                                           homework,
                                           setHomework,
                                           token,
                                           onChanged,
                                       }) {
    const toast = useToast();
    const [form, setForm] = useState({
        title: homework?.title || '',
        description: homework?.description || '',
        maxFiles: homework?.maxFiles ?? 3,
        maxFileSizeMb: homework?.maxFileSizeMb ?? 50,
        dueAt: toLocalInput(homework?.dueAt),
        hoursToComplete: homework?.hoursToComplete ?? '',
        latePenaltyPerDay: homework?.latePenaltyPerDay ?? 0,
        latePenaltyMax: homework?.latePenaltyMax ?? 5,
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
                hoursToComplete: form.hoursToComplete === ''
                    ? null
                    : Number(form.hoursToComplete) || null,
                dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
                latePenaltyPerDay: Number(form.latePenaltyPerDay) || 0,
                latePenaltyMax: Number(form.latePenaltyMax) || 5,
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
            toast.success('ДЗ удалено');
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <div className="space-y-3">
            <div className="text-sm font-bold mb-1">
                📋 Домашнее задание {homework ? '(создано)' : '(нет)'}
            </div>
            {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    {error}
                </div>
            )}

            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Название</label>
                <input
                    className="input"
                    value={form.title}
                    onChange={set('title')}
                    placeholder="Название ДЗ"
                />
            </div>

            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">
                    Описание (поддерживает markdown)
                </label>
                <textarea
                    rows={6}
                    className="input resize-none text-sm"
                    value={form.description}
                    onChange={set('description')}
                    placeholder="Описание задания"
                />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">
                        Макс. файлов
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="20"
                        className="input"
                        value={form.maxFiles}
                        onChange={set('maxFiles')}
                    />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">
                        Макс. размер (МБ)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="500"
                        className="input"
                        value={form.maxFileSizeMb}
                        onChange={set('maxFileSizeMb')}
                    />
                </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="text-xs text-white/60 uppercase font-semibold">
                    ⏱ Срок сдачи
                </div>

                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">
                        Часов на выполнение после прохождения урока
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="2000"
                        className="input"
                        value={form.hoursToComplete}
                        onChange={set('hoursToComplete')}
                        placeholder="например, 24"
                    />
                    <div className="text-[11px] text-white/40 mt-1">
                        Отсчёт начнётся в момент, когда студент пройдёт урок.
                    </div>
                </div>

                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">
                        Или фиксированная дата
                    </label>
                    <input
                        type="datetime-local"
                        className="input"
                        value={form.dueAt}
                        onChange={set('dueAt')}
                    />
                    <div className="text-[11px] text-white/40 mt-1">
                        Если указано «часов на выполнение» — фиксированная дата игнорируется.
                    </div>
                </div>
            </div>

            <div className="p-3 rounded-xl bg-pink/5 border border-pink/20 space-y-3">
                <div className="text-xs text-pink uppercase font-semibold">
                    ⚠️ Штраф за просрочку
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Баллов за каждые 24 ч просрочки
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            className="input"
                            value={form.latePenaltyPerDay}
                            onChange={set('latePenaltyPerDay')}
                        />
                        <div className="text-[11px] text-white/40 mt-1">
                            0 — штрафа нет. Например, 0.5 — минус полбалла в сутки.
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">
                            Максимум снятия (баллов)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            className="input"
                            value={form.latePenaltyMax}
                            onChange={set('latePenaltyMax')}
                        />
                        <div className="text-[11px] text-white/40 mt-1">
                            Оценка не опустится ниже 1 из 5.
                        </div>
                    </div>
                </div>

                <div className="text-[11px] text-white/50">
                    Штраф фиксируется в момент сдачи. Например: 24 ч, потом ещё
                    каждые сутки. При проверке руководитель видит рекомендованную оценку
                    с учётом штрафа.
                </div>
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