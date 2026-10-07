import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';
import { useToast } from '../../../store/toast.jsx';

/* ─────── Утилиты для даты ─────── */
function toLocalInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function PracticalsHomework({ token, courses = [] }) {
    const toast = useToast();
    const [tab, setTab] = useState('practicals');
    const [practicals, setPracticals] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [courseFilter, setCourseFilter] = useState('');
    const [supervisorFilter, setSupervisorFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [p, h, m] = await Promise.all([
                api('/admin/practicals-list', { token }),
                api('/admin/homeworks-list', { token }),
                api('/admin/mentors', { token }),
            ]);
            setPracticals(Array.isArray(p) ? p : []);
            setHomeworks(Array.isArray(h) ? h : []);
            setMentors(Array.isArray(m) ? m : []);
        } catch (e) {
            setError(e.message || 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const filteredPracticals = useMemo(() => {
        let list = practicals;

        if (courseFilter) list = list.filter((p) => p.courseId === courseFilter);
        if (supervisorFilter === 'none') list = list.filter((p) => !p.supervisorId);
        else if (supervisorFilter) list = list.filter((p) => p.supervisorId === supervisorFilter);

        if (dateFilter === 'set') list = list.filter((p) => p.scheduledAt);
        else if (dateFilter === 'none') list = list.filter((p) => !p.scheduledAt);

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((p) =>
                p.topic.toLowerCase().includes(q) ||
                p.course?.title?.toLowerCase().includes(q) ||
                p.lesson?.title?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [practicals, courseFilter, supervisorFilter, dateFilter, search]);

    const filteredHomeworks = useMemo(() => {
        let list = homeworks;

        if (courseFilter) list = list.filter((h) => h.lesson?.course?.id === courseFilter);

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((h) =>
                h.title.toLowerCase().includes(q) ||
                h.lesson?.course?.title?.toLowerCase().includes(q) ||
                h.lesson?.title?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [homeworks, courseFilter, search]);

    const counts = useMemo(() => {
        return {
            practicals: {
                total: practicals.length,
                withSupervisor: practicals.filter((p) => p.supervisorId).length,
                withDate: practicals.filter((p) => p.scheduledAt).length,
                pending: practicals.reduce((s, p) => s + (p.pendingCount || 0), 0),
            },
            homeworks: {
                total: homeworks.length,
                pending: homeworks.reduce((s, h) => s + (h.pendingCount || 0), 0),
            },
        };
    }, [practicals, homeworks]);

    const updatePractical = async (id, patch) => {
        const updated = await api(`/admin/practicals/${id}`, {
            method: 'PATCH',
            token,
            body: patch,
        });
        setPracticals((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    };

    const deletePractical = async (id) => {
        if (!confirm('Удалить практику?')) return;
        try {
            await api(`/admin/practicals/${id}`, { method: 'DELETE', token });
            setPracticals((prev) => prev.filter((p) => p.id !== id));
            toast.success('Практика удалена');
        } catch (e) {
            toast.error(e.message);
        }
    };

    const updateHomework = async (id, patch) => {
        const updated = await api(`/admin/homework/${id}`, {
            method: 'PATCH',
            token,
            body: patch,
        });
        setHomeworks((prev) =>
            prev.map((h) => (h.id === id ? { ...h, ...updated } : h))
        );
    };

    const deleteHomework = async (id) => {
        if (!confirm('Удалить ДЗ?')) return;
        try {
            await api(`/admin/homework/${id}`, { method: 'DELETE', token });
            setHomeworks((prev) => prev.filter((h) => h.id !== id));
            toast.success('ДЗ удалено');
        } catch (e) {
            toast.error(e.message);
        }
    };

    const bulkAssignSupervisor = async () => {
        if (!courseFilter) {
            toast.warn('Сначала выберите курс в фильтре');
            return;
        }
        if (!supervisorFilter) {
            toast.warn('Выберите руководителя в фильтре');
            return;
        }
        if (!confirm(
            `Назначить выбранного руководителя на ВСЕ практики курса «${
                courses.find((c) => c.id === courseFilter)?.title || courseFilter
            }»?`
        )) return;
        try {
            const r = await api('/admin/practicals/bulk-assign-supervisor', {
                method: 'POST',
                token,
                body: { courseId: courseFilter, supervisorId: supervisorFilter },
            });
            toast.success(`Обновлено практик: ${r.affected}`);
            await load();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const bulkDeleteHomeworks = async () => {
        if (!courseFilter) {
            toast.warn('Сначала выберите курс в фильтре');
            return;
        }
        const c = courses.find((x) => x.id === courseFilter);
        if (!confirm(
            `Удалить ВСЕ ДЗ курса «${c?.title || courseFilter}»?\nЭто действие нельзя отменить.`
        )) return;
        try {
            const r = await api('/admin/homeworks/bulk-delete', {
                method: 'POST',
                token,
                body: { courseId: courseFilter },
            });
            toast.success(`Удалено ДЗ: ${r.affected}`);
            await load();
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-2xl font-bold">🎯 Практики и домашние задания</h2>
                    <div className="text-sm text-white/50 mt-1">
                        Управление всеми практиками и ДЗ по курсам
                    </div>
                </div>
                <button onClick={load} disabled={loading} className="btn-ghost text-sm">
                    {loading ? '⏳' : '🔄 Обновить'}
                </button>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
                <button
                    onClick={() => setTab('practicals')}
                    className={`px-4 py-2 rounded-xl text-sm transition ${
                        tab === 'practicals'
                            ? 'bg-violet-soft/20 text-white'
                            : 'hover:bg-white/5 text-white/70'
                    }`}
                >
                    🎯 Практики
                    <span className="ml-2 text-xs text-white/40">
                        {counts.practicals.total}
                    </span>
                    {counts.practicals.pending > 0 && (
                        <span className="ml-2 text-xs bg-pink text-white rounded-full px-2 py-0.5">
                            {counts.practicals.pending} на проверке
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('homeworks')}
                    className={`px-4 py-2 rounded-xl text-sm transition ${
                        tab === 'homeworks'
                            ? 'bg-violet-soft/20 text-white'
                            : 'hover:bg-white/5 text-white/70'
                    }`}
                >
                    📋 ДЗ
                    <span className="ml-2 text-xs text-white/40">
                        {counts.homeworks.total}
                    </span>
                    {counts.homeworks.pending > 0 && (
                        <span className="ml-2 text-xs bg-pink text-white rounded-full px-2 py-0.5">
                            {counts.homeworks.pending} на проверке
                        </span>
                    )}
                </button>
            </div>

            <div className="card p-4 mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    <select
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="input !py-2 text-sm max-w-xs"
                    >
                        <option value="">Все курсы</option>
                        {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>

                    {tab === 'practicals' && (
                        <>
                            <select
                                value={supervisorFilter}
                                onChange={(e) => setSupervisorFilter(e.target.value)}
                                className="input !py-2 text-sm max-w-xs"
                            >
                                <option value="">Все руководители</option>
                                <option value="none">— без руководителя —</option>
                                {mentors.map((m) => (
                                    <option key={m.id} value={m.id}>{m.fullName}</option>
                                ))}
                            </select>

                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="input !py-2 text-sm max-w-xs"
                            >
                                <option value="">Все даты</option>
                                <option value="set">— с датой —</option>
                                <option value="none">— без даты —</option>
                            </select>
                        </>
                    )}

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск…"
                        className="input !py-2 text-sm max-w-xs"
                    />

                    {(courseFilter || supervisorFilter || dateFilter || search) && (
                        <button
                            onClick={() => {
                                setCourseFilter('');
                                setSupervisorFilter('');
                                setDateFilter('');
                                setSearch('');
                            }}
                            className="btn-ghost text-xs"
                        >
                            Сбросить
                        </button>
                    )}
                </div>

                {courseFilter && (
                    <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2 items-center text-xs">
                        <span className="text-white/40">Массовые действия:</span>
                        {tab === 'practicals' && (
                            <button
                                onClick={bulkAssignSupervisor}
                                disabled={!supervisorFilter || supervisorFilter === 'none'}
                                className="btn-ghost !py-1 text-xs disabled:opacity-30"
                                title={!supervisorFilter ? 'Сначала выберите руководителя в фильтре' : ''}
                            >
                                👤 Назначить выбранного руководителя на все практики курса
                            </button>
                        )}
                        {tab === 'homeworks' && (
                            <button
                                onClick={bulkDeleteHomeworks}
                                className="btn-ghost !py-1 text-xs text-pink"
                            >
                                🗑 Удалить все ДЗ курса
                            </button>
                        )}
                    </div>
                )}
            </div>

            {loading && <div className="text-white/40 text-center py-10">Загрузка…</div>}
            {error && <div className="text-red-400 text-center py-10">{error}</div>}

            {!loading && !error && tab === 'practicals' && (
                <div className="space-y-3">
                    {filteredPracticals.length === 0 && (
                        <div className="card p-8 text-center text-white/40">
                            Практик не найдено
                        </div>
                    )}
                    {filteredPracticals.map((p) => (
                        <PracticalRow
                            key={p.id}
                            practical={p}
                            mentors={mentors}
                            onSave={(patch) => updatePractical(p.id, patch)}
                            onDelete={() => deletePractical(p.id)}
                        />
                    ))}
                </div>
            )}

            {!loading && !error && tab === 'homeworks' && (
                <div className="space-y-3">
                    {filteredHomeworks.length === 0 && (
                        <div className="card p-8 text-center text-white/40">
                            ДЗ не найдено
                        </div>
                    )}
                    {filteredHomeworks.map((h) => (
                        <HomeworkRow
                            key={h.id}
                            homework={h}
                            onSave={(patch) => updateHomework(h.id, patch)}
                            onDelete={() => deleteHomework(h.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════ СТРОКА ПРАКТИКИ ═══════════ */
function PracticalRow({ practical, mentors, onSave, onDelete }) {
    const toast = useToast();
    const [form, setForm] = useState({
        supervisorId: practical.supervisorId || '',
        scheduledAt: toLocalInput(practical.scheduledAt),
        durationMin: practical.durationMin || 90,
        location: practical.location || '',
    });
    const [busy, setBusy] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const dirty =
        (form.supervisorId || '') !== (practical.supervisorId || '') ||
        form.scheduledAt !== toLocalInput(practical.scheduledAt) ||
        Number(form.durationMin) !== (practical.durationMin || 90) ||
        (form.location || '') !== (practical.location || '');

    const save = async () => {
        setBusy(true);
        try {
            await onSave({
                supervisorId: form.supervisorId || null,
                scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
                durationMin: Number(form.durationMin) || 90,
                location: form.location || null,
            });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1500);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const statusBadge = practical.pendingCount > 0 ? (
        <span className="chip bg-amber-500/20 text-amber-200">
            {practical.pendingCount} на проверке
        </span>
    ) : practical.approvedCount > 0 ? (
        <span className="chip bg-emerald-500/20 text-emerald-200">
            ✓ {practical.approvedCount} принято
        </span>
    ) : (
        <span className="chip bg-white/5 text-white/40">нет сдач</span>
    );

    return (
        <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-white/40">
                            {practical.course?.title} · урок {practical.lesson?.order}
                        </span>
                        {statusBadge}
                    </div>
                    <div className="font-semibold text-white truncate">
                        {practical.topic}
                    </div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                        {practical.lesson?.title}
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    className="chip bg-white/5 hover:bg-pink/30 text-xs shrink-0"
                    title="Удалить практику"
                >
                    🗑
                </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Дата и время
                    </label>
                    <input
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                        className="input !py-1.5 text-sm"
                    />
                    {!form.scheduledAt && (
                        <div className="text-[10px] text-amber-300/70 mt-1">не назначена</div>
                    )}
                </div>

                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Руководитель
                    </label>
                    <select
                        value={form.supervisorId}
                        onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}
                        className="input !py-1.5 text-sm"
                    >
                        <option value="">— не назначен —</option>
                        {mentors.map((m) => (
                            <option key={m.id} value={m.id}>{m.fullName}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Длительность (мин)
                    </label>
                    <input
                        type="number"
                        min="15"
                        max="600"
                        value={form.durationMin}
                        onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                        className="input !py-1.5 text-sm"
                    />
                </div>

                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Место
                    </label>
                    <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="аудитория / онлайн"
                        className="input !py-1.5 text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5">
                {savedFlash && (
                    <span className="text-xs text-lime">✓ Сохранено</span>
                )}
                {dirty && !savedFlash && (
                    <span className="text-xs text-amber-300">• есть несохранённые изменения</span>
                )}
                <button
                    onClick={save}
                    disabled={busy || !dirty}
                    className="btn-primary !py-1.5 text-xs disabled:opacity-30"
                >
                    {busy ? 'Сохранение…' : '💾 Сохранить'}
                </button>
            </div>
        </div>
    );
}

/* ═══════════ СТРОКА ДЗ ═══════════ */
function HomeworkRow({ homework, onSave, onDelete }) {
    const toast = useToast();
    const [form, setForm] = useState({
        maxFiles: homework.maxFiles ?? 3,
        maxFileSizeMb: homework.maxFileSizeMb ?? 50,
    });
    const [busy, setBusy] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const dirty =
        Number(form.maxFiles) !== (homework.maxFiles ?? 3) ||
        Number(form.maxFileSizeMb) !== (homework.maxFileSizeMb ?? 50);

    const save = async () => {
        setBusy(true);
        try {
            await onSave({
                maxFiles: Number(form.maxFiles) || 3,
                maxFileSizeMb: Number(form.maxFileSizeMb) || 50,
            });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1500);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const statusBadge = homework.pendingCount > 0 ? (
        <span className="chip bg-amber-500/20 text-amber-200">
            {homework.pendingCount} на проверке
        </span>
    ) : homework.approvedCount > 0 ? (
        <span className="chip bg-emerald-500/20 text-emerald-200">
            ✓ {homework.approvedCount} принято
        </span>
    ) : (
        <span className="chip bg-white/5 text-white/40">нет сдач</span>
    );

    return (
        <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-white/40">
                            {homework.lesson?.course?.title} · урок {homework.lesson?.order}
                        </span>
                        {statusBadge}
                    </div>
                    <div className="font-semibold text-white truncate">
                        {homework.title}
                    </div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                        {homework.lesson?.title}
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    className="chip bg-white/5 hover:bg-pink/30 text-xs shrink-0"
                    title="Удалить ДЗ"
                >
                    🗑
                </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Макс. файлов
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="20"
                        value={form.maxFiles}
                        onChange={(e) => setForm((f) => ({ ...f, maxFiles: e.target.value }))}
                        className="input !py-1.5 text-sm"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-white/40 block mb-1">
                        Макс. размер файла (МБ)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="500"
                        value={form.maxFileSizeMb}
                        onChange={(e) => setForm((f) => ({ ...f, maxFileSizeMb: e.target.value }))}
                        className="input !py-1.5 text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5">
                {savedFlash && <span className="text-xs text-lime">✓ Сохранено</span>}
                {dirty && !savedFlash && (
                    <span className="text-xs text-amber-300">• есть несохранённые изменения</span>
                )}
                <button
                    onClick={save}
                    disabled={busy || !dirty}
                    className="btn-primary !py-1.5 text-xs disabled:opacity-30"
                >
                    {busy ? 'Сохранение…' : '💾 Сохранить'}
                </button>
            </div>
        </div>
    );
}