import { useEffect, useMemo, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import Avatar from '../components/Avatar.jsx';

const TABS = {
    practicals: { key: 'practicals', label: '🎯 Практики' },
    homework: { key: 'homework', label: '📋 ДЗ' },
};

const STATUS_TABS = [
    { key: 'pending', label: '⏳ На проверке' },
    { key: 'reviewed', label: '✅ Проверенные' },
    { key: 'all', label: '📋 Все' },
];

export default function MentorReviews() {
    const { token, user } = useAuth();
    const [tab, setTab] = useState('practicals');
    const [statusTab, setStatusTab] = useState('pending');
    const [courseFilter, setCourseFilter] = useState('');
    const [search, setSearch] = useState('');

    const [practicals, setPracticals] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [p, h] = await Promise.all([
                api('/practicals/review', { token }),
                api('/homework/review', { token }),
            ]);
            setPracticals(Array.isArray(p) ? p : []);
            setHomeworks(Array.isArray(h) ? h : []);
        } catch (e) {
            setError(e.message || 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'MENTOR' || user?.role === 'ADMIN') load();
    }, [token, user]);

    // Разворачиваем практики в плоский список сдач
    const practicalSubmissions = useMemo(() => {
        const items = [];
        for (const p of practicals) {
            for (const s of p.submissions || []) {
                items.push({
                    ...s,
                    _kind: 'practical',
                    _practical: {
                        id: p.id,
                        topic: p.topic,
                        description: p.description,
                        scheduledAt: p.scheduledAt,
                    },
                    _course: p.course,
                    _lesson: p.lesson,
                });
            }
        }
        return items;
    }, [practicals]);

    const homeworkSubmissions = useMemo(
        () => homeworks.map((h) => ({ ...h, _kind: 'homework' })),
        [homeworks]
    );

    // Список уникальных курсов для фильтра (из практик + ДЗ)
    const courseOptions = useMemo(() => {
        const map = new Map();
        for (const s of practicalSubmissions) {
            if (s._course?.id) map.set(s._course.id, s._course.title);
        }
        for (const s of homeworkSubmissions) {
            const c = s.homework?.lesson?.course;
            if (c?.id) map.set(c.id, c.title);
        }
        return Array.from(map, ([id, title]) => ({ id, title }));
    }, [practicalSubmissions, homeworkSubmissions]);

    const currentList = tab === 'practicals' ? practicalSubmissions : homeworkSubmissions;

    const filtered = useMemo(() => {
        let list = currentList;

        // статус
        if (statusTab === 'pending') list = list.filter((s) => s.status === 'PENDING');
        else if (statusTab === 'reviewed')
            list = list.filter((s) => s.status === 'APPROVED' || s.status === 'REJECTED');

        // курс
        if (courseFilter) {
            list = list.filter((s) => {
                const cid =
                    s._kind === 'practical'
                        ? s._course?.id
                        : s.homework?.lesson?.course?.id;
                return cid === courseFilter;
            });
        }

        // поиск по студенту
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((s) => {
                const name = (s.user?.fullName || '').toLowerCase();
                const username = (s.user?.username || '').toLowerCase();
                return name.includes(q) || username.includes(q);
            });
        }

        return list;
    }, [currentList, statusTab, courseFilter, search]);

    const counts = useMemo(() => {
        const forList = (list) => ({
            pending: list.filter((s) => s.status === 'PENDING').length,
            reviewed: list.filter(
                (s) => s.status === 'APPROVED' || s.status === 'REJECTED'
            ).length,
            all: list.length,
        });
        return {
            practicals: forList(practicalSubmissions),
            homework: forList(homeworkSubmissions),
        };
    }, [practicalSubmissions, homeworkSubmissions]);

    if (user?.role !== 'MENTOR' && user?.role !== 'ADMIN') {
        return (
            <div className="p-10 text-center text-white/60">
                Доступ только для руководителей.
            </div>
        );
    }

    const reviewSubmission = async (kind, submissionId, status, feedback, grade) => {
        setBusyId(submissionId);
        try {
            const url =
                kind === 'practical'
                    ? `/practicals/submissions/${submissionId}/review`
                    : `/homework/submissions/${submissionId}/review`;
            await api(url, {
                token,
                method: 'POST',
                body: { status, feedback, grade },
            });
            await load();
        } catch (e) {
            alert(e.message || 'Не удалось сохранить проверку');
        } finally {
            setBusyId(null);
        }
    };

    const currentCounts = tab === 'practicals' ? counts.practicals : counts.homework;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">🧑‍🏫 Кабинет руководителя</h1>
                    <div className="text-sm text-white/50 mt-1">
                        ПРОВЕРКА ПРАКТИК И ДОМАШНИХ ЗАДАНИЙ
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="btn-ghost text-sm"
                    title="Обновить"
                >
                    {loading ? '⏳ Загрузка…' : '🔄 Обновить'}
                </button>
            </div>

            {/* Табы практики / ДЗ */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {Object.values(TABS).map((t) => {
                    const c = counts[t.key];
                    const badge = c.pending > 0 ? c.pending : 0;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2 rounded-xl text-sm transition flex items-center gap-2 ${
                                tab === t.key
                                    ? 'bg-violet-soft/20 text-white'
                                    : 'hover:bg-white/5 text-white/70'
                            }`}
                        >
                            <span>{t.label}</span>
                            {badge > 0 && (
                                <span className="text-xs bg-pink text-white rounded-full px-2 py-0.5">
                                    {badge}
                                </span>
                            )}
                            <span className="text-xs text-white/40">
                                всего {c.all}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Статусы */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {STATUS_TABS.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setStatusTab(s.key)}
                        className={`chip ${
                            statusTab === s.key
                                ? 'bg-white/15 text-white'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        {s.label}
                        <span className="ml-2 text-white/40">
                            {currentCounts[s.key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-2 mb-5">
                <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="input !py-2 text-sm max-w-xs"
                >
                    <option value="">Все курсы</option>
                    {courseOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.title}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по студенту…"
                    className="input !py-2 text-sm max-w-xs"
                />
                {(courseFilter || search) && (
                    <button
                        onClick={() => {
                            setCourseFilter('');
                            setSearch('');
                        }}
                        className="btn-ghost text-xs"
                    >
                        Сбросить
                    </button>
                )}
            </div>

            {loading && <div className="text-white/40 text-center py-10">Загрузка…</div>}
            {error && <div className="text-red-400 text-center py-10">{error}</div>}

            {!loading && !error && filtered.length === 0 && (
                <div className="card p-10 text-center">
                    <div className="text-5xl mb-3">
                        {statusTab === 'pending' ? '🎉' : '📭'}
                    </div>
                    <div className="text-white/70 font-medium">
                        {statusTab === 'pending'
                            ? 'Всё проверено!'
                            : 'Ничего не найдено'}
                    </div>
                    <div className="text-sm text-white/40 mt-1">
                        {statusTab === 'pending'
                            ? 'Новых сдач на проверку нет'
                            : 'Попробуйте изменить фильтры'}
                    </div>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="space-y-4">
                    {filtered.map((s) =>
                        s._kind === 'practical' ? (
                            <PracticalReviewCard
                                key={s.id}
                                submission={s}
                                busy={busyId === s.id}
                                onReview={(status, feedback, grade) =>
                                    reviewSubmission('practical', s.id, status, feedback, grade)
                                }
                            />
                        ) : (
                            <HomeworkReviewCard
                                key={s.id}
                                submission={s}
                                busy={busyId === s.id}
                                onReview={(status, feedback, grade) =>
                                    reviewSubmission('homework', s.id, status, feedback, grade)
                                }
                            />
                        )
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────── КАРТОЧКА ПРАКТИКИ ─────────── */
function PracticalReviewCard({ submission, busy, onReview }) {
    const [open, setOpen] = useState(submission.status === 'PENDING');
    const [feedback, setFeedback] = useState('');
    const [grade, setGrade] = useState('');

    const p = submission._practical || {};
    const course = submission._course;
    const lesson = submission._lesson;

    return (
        <div className="card p-5">
            <div className="flex items-start gap-4 mb-3 flex-wrap">
                <Avatar user={submission.user} size={44} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-white/40">
                            {course?.title} · урок {lesson?.order} · 🎯 практика
                        </span>
                        <StatusBadge status={submission.status} />
                    </div>
                    <div className="font-semibold text-white truncate">
                        {p.topic}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                        Студент: {submission.user?.fullName || submission.user?.username}
                        {submission.updatedAt && (
                            <span className="ml-2">
                                · {new Date(submission.updatedAt).toLocaleString('ru-RU')}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="btn-ghost text-xs"
                >
                    {open ? 'Свернуть' : 'Развернуть'}
                </button>
            </div>

            {open && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    {/* Описание практики */}
                    <div className="text-sm text-white/60 whitespace-pre-wrap">
                        {p.description}
                    </div>

                    {/* Комментарий студента */}
                    {submission.note && (
                        <div className="text-sm bg-white/5 border border-white/10 rounded-lg p-3">
                            <div className="text-xs text-white/40 mb-1">Комментарий студента</div>
                            <div className="text-white/80 whitespace-pre-wrap">
                                {submission.note}
                            </div>
                        </div>
                    )}

                    {/* Если уже проверено — показываем результат */}
                    {submission.status !== 'PENDING' && submission.reviewedAt && (
                        <div
                            className={`rounded-lg p-3 text-sm border ${
                                submission.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            }`}
                        >
                            <div className="font-medium mb-1">
                                {submission.status === 'APPROVED' ? '✓ Принято' : '↺ Отклонено'}
                                {submission.grade != null && ` · Оценка ${submission.grade}/5`}
                            </div>
                            <div className="text-xs opacity-70">
                                {submission.reviewer?.fullName || submission.reviewer?.username} ·{' '}
                                {new Date(submission.reviewedAt).toLocaleString('ru-RU')}
                            </div>
                            {submission.feedback && (
                                <div className="mt-2">{submission.feedback}</div>
                            )}
                        </div>
                    )}

                    {/* Форма проверки */}
                    {submission.status === 'PENDING' && (
                        <ReviewForm
                            busy={busy}
                            feedback={feedback}
                            setFeedback={setFeedback}
                            grade={grade}
                            setGrade={setGrade}
                            onSubmit={(status) =>
                                onReview(status, feedback, grade ? Number(grade) : null)
                            }
                        />
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────── КАРТОЧКА ДЗ ─────────── */
function HomeworkReviewCard({ submission, busy, onReview }) {
    const [open, setOpen] = useState(submission.status === 'PENDING');
    const [feedback, setFeedback] = useState('');
    const [grade, setGrade] = useState('');
    const [applyPenalty, setApplyPenalty] = useState(true);

    const hw = submission.homework || {};
    const lesson = hw.lesson || {};
    const course = lesson.course;

    let files = [];
    try {
        files = JSON.parse(submission.files || '[]');
    } catch {}

    const latePenalty = submission.latePenalty || 0;
    const lateDays = submission.lateDays || 0;
    const rawGrade = grade !== '' ? Number(grade) : null;
    const recommended =
        applyPenalty && rawGrade != null
            ? Math.max(1, Math.round((rawGrade - latePenalty) * 10) / 10)
            : rawGrade;

    return (
        <div className="card p-5">
            <div className="flex items-start gap-4 mb-3 flex-wrap">
                <Avatar user={submission.user} size={44} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-white/40">
                            {course?.title} · урок {lesson.order} · 📋 ДЗ
                        </span>
                        <StatusBadge status={submission.status} />
                        {latePenalty > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-pink/20 text-pink">
                                ⚠️ +{lateDays} дн.
                            </span>
                        )}
                    </div>
                    <div className="font-semibold text-white truncate">{hw.title}</div>
                    <div className="text-xs text-white/50 mt-1">
                        Студент: {submission.user?.fullName || submission.user?.username}
                        {submission.createdAt && (
                            <span className="ml-2">
                                · сдано {new Date(submission.createdAt).toLocaleString('ru-RU')}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="btn-ghost text-xs"
                >
                    {open ? 'Свернуть' : 'Развернуть'}
                </button>
            </div>

            {open && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    {latePenalty > 0 && (
                        <div className="text-sm bg-pink/10 border border-pink/30 text-pink rounded-lg p-3">
                            ⚠️ Сдано с опозданием на <b>{lateDays} дн.</b>.
                            Штраф: <b>−{latePenalty}</b> балла (зафиксирован при сдаче).
                        </div>
                    )}

                    {submission.text && (
                        <div className="text-sm bg-white/5 border border-white/10 rounded-lg p-3">
                            <div className="text-xs text-white/40 mb-1">Текстовый ответ</div>
                            <div className="text-white/80 whitespace-pre-wrap">
                                {submission.text}
                            </div>
                        </div>
                    )}
                    {submission.link && (
                        <div className="text-sm">
                            <span className="text-white/40">Ссылка: </span>
                            <a
                                href={submission.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-violet-soft hover:underline break-all"
                            >
                                {submission.link}
                            </a>
                        </div>
                    )}
                    {files.length > 0 && (
                        <div>
                            <div className="text-xs text-white/40 mb-1">Файлы</div>
                            <div className="flex flex-wrap gap-2">
                                {files.map((f, i) => (
                                    <a
                                        key={i}
                                        href={f.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:border-white/20"
                                    >
                                        📎 {f.name || `Файл ${i + 1}`}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {submission.status !== 'PENDING' && submission.reviewedAt && (
                        <div
                            className={`rounded-lg p-3 text-sm border ${
                                submission.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            }`}
                        >
                            <div className="font-medium mb-1">
                                {submission.status === 'APPROVED' ? '✓ Принято' : '↺ Отклонено'}
                                {submission.finalGrade != null
                                    ? ` · Итоговая оценка: ${submission.finalGrade}/5`
                                    : submission.grade != null
                                        ? ` · Оценка ${submission.grade}/5`
                                        : ''}
                                {submission.latePenalty > 0 && submission.status === 'APPROVED' && (
                                    <span className="ml-1 opacity-80">
                                        (штраф −{submission.latePenalty})
                                    </span>
                                )}
                            </div>
                            <div className="text-xs opacity-70">
                                {submission.reviewer?.fullName || submission.reviewer?.username} ·{' '}
                                {new Date(submission.reviewedAt).toLocaleString('ru-RU')}
                            </div>
                            {submission.feedback && (
                                <div className="mt-2">{submission.feedback}</div>
                            )}
                        </div>
                    )}

                    {submission.status === 'PENDING' && (
                        <div className="pt-3 border-t border-white/10 space-y-3">
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Комментарий для студента"
                                className="input w-full text-sm"
                                rows={3}
                            />

                            <div className="flex items-center gap-3 flex-wrap">
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    step={1}
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    placeholder="Оценка 1–5"
                                    className="input w-32 text-sm"
                                />

                                {latePenalty > 0 && (
                                    <label className="flex items-center gap-2 text-xs text-white/70">
                                        <input
                                            type="checkbox"
                                            checked={applyPenalty}
                                            onChange={(e) => setApplyPenalty(e.target.checked)}
                                        />
                                        Применить штраф −{latePenalty}
                                    </label>
                                )}

                                {recommended != null && latePenalty > 0 && applyPenalty && (
                                    <span className="text-xs text-white/60">
                                        Итог: <b className="text-white">{recommended}/5</b>
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                <button
                                    disabled={busy}
                                    onClick={() => onReview('APPROVED', feedback, recommended)}
                                    className="btn-primary text-sm disabled:opacity-40"
                                >
                                    ✓ Принять
                                </button>
                                <button
                                    disabled={busy}
                                    onClick={() => onReview('REJECTED', feedback, null)}
                                    className="btn-ghost text-sm disabled:opacity-40"
                                >
                                    ↺ На доработку
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────── ОБЩИЕ ─────────── */
function StatusBadge({ status }) {
    const map = {
        PENDING: ['bg-amber-500/20 text-amber-200', '⏳ На проверке'],
        APPROVED: ['bg-emerald-500/20 text-emerald-200', '✓ Принято'],
        REJECTED: ['bg-red-500/20 text-red-200', '↺ На доработке'],
    };
    const [cls, label] = map[status] || ['bg-white/10 text-white/60', status];
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function ReviewForm({ busy, feedback, setFeedback, grade, setGrade, onSubmit }) {
    return (
        <div className="pt-3 border-t border-white/10 space-y-3">
            <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Комментарий для студента (что получилось, что доработать)"
                className="input w-full text-sm"
                rows={3}
            />
            <div className="flex items-center gap-3 flex-wrap">
                <input
                    type="number"
                    min={1}
                    max={5}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Оценка 1–5"
                    className="input w-32 text-sm"
                />
                <button
                    disabled={busy}
                    onClick={() => onSubmit('APPROVED')}
                    className="btn-primary text-sm disabled:opacity-40"
                >
                    {busy ? '…' : '✓ Принять'}
                </button>
                <button
                    disabled={busy}
                    onClick={() => onSubmit('REJECTED')}
                    className="btn-ghost text-sm disabled:opacity-40"
                >
                    ↺ На доработку
                </button>
            </div>
        </div>
    );
}