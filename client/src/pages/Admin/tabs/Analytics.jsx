import { useEffect, useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar, LineChart, Line,
} from 'recharts';
import { api } from '../../../api/client.js';

export default function Analytics({ token }) {
    const [tab, setTab] = useState('overview'); // overview | funnel

    return (
        <div className="space-y-5">
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('overview')}
                    className={`px-4 py-2 rounded-xl text-sm transition ${
                        tab === 'overview'
                            ? 'bg-violet-soft/20 text-white'
                            : 'hover:bg-white/5 text-white/70'
                    }`}
                >
                    📊 Общая аналитика
                </button>
                <button
                    onClick={() => setTab('funnel')}
                    className={`px-4 py-2 rounded-xl text-sm transition ${
                        tab === 'funnel'
                            ? 'bg-violet-soft/20 text-white'
                            : 'hover:bg-white/5 text-white/70'
                    }`}
                >
                    📉 Воронка по курсам
                </button>
            </div>

            {tab === 'overview' && <OverviewTab token={token} />}
            {tab === 'funnel' && <FunnelTab token={token} />}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TAB 1. ОБЩАЯ АНАЛИТИКА (как было)
   ═══════════════════════════════════════════════════════════ */
function OverviewTab({ token }) {
    const [period, setPeriod] = useState(30);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        api(`/admin/analytics?period=${period}`, { token })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [period, token]);

    if (loading && !data) return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
    if (error) return <div className="card p-4 text-pink bg-pink/10">{error}</div>;
    if (!data) return null;

    return (
        <div className="space-y-5">
            <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-bold text-lg">📈 Аналитика</div>
                <div className="flex gap-2">
                    {[7, 30, 90, 180].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`chip ${period === p ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                        >
                            {p} дн.
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    ['👥', 'Пользователи', data.totals.users],
                    ['📚', 'Курсы', data.totals.courses],
                    ['✉️', 'Сообщения', data.totals.messages],
                    ['📝', 'Посты', data.totals.posts],
                    ['💬', 'Комментарии', data.totals.comments],
                ].map(([i, l, v]) => (
                    <div key={l} className="card p-4">
                        <div className="text-2xl mb-1">{i}</div>
                        <div className="text-2xl font-bold">{v}</div>
                        <div className="text-xs text-white/50">{l}</div>
                    </div>
                ))}
            </div>

            <div className="card p-5">
                <div className="font-bold mb-4">Регистрации по дням</div>
                <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                        <AreaChart data={data.registrationsByDay}>
                            <defs>
                                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                            <Area type="monotone" dataKey="value" name="Регистрации" stroke="#A78BFA" strokeWidth={2} fill="url(#regGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card p-5">
                <div className="font-bold mb-4">Активность по дням</div>
                <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                        <LineChart data={data.activityByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                            <Line type="monotone" dataKey="messages" name="Сообщения" stroke="#EC4899" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="comments" name="Комментарии" stroke="#06B6D4" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="posts" name="Посты" stroke="#84CC16" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
                <div className="card p-5">
                    <div className="font-bold mb-4">Топ курсов по записям</div>
                    {data.topCourses.length === 0 ? (
                        <div className="text-center text-white/40 py-8">Нет данных</div>
                    ) : (
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={data.topCourses} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                                    <YAxis type="category" dataKey="title" stroke="rgba(255,255,255,0.4)" fontSize={10} width={140} />
                                    <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                                    <Bar dataKey="enrollments" name="Записей" fill="#7C3AED" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <div className="font-bold mb-4">Топ постов</div>
                    {data.topPosts.length === 0 ? (
                        <div className="text-center text-white/40 py-8">Нет данных</div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {data.topPosts.map((p, i) => (
                                <div key={p.id} className="p-3 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-violet-soft">#{i + 1}</span>
                                        <span className="text-sm font-semibold truncate">{p.author.fullName}</span>
                                        <span className="text-[10px] text-white/40 ml-auto shrink-0">
                                            💬 {p.comments} · ❤️ {p.reactions}
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/60 line-clamp-2">{p.content || '(без текста)'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TAB 2. ВОРОНКА ПО КУРСАМ
   ═══════════════════════════════════════════════════════════ */
function FunnelTab({ token }) {
    const [period, setPeriod] = useState(30);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedCourseId, setExpandedCourseId] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError('');
        api(`/admin/analytics/courses?period=${period}`, { token })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [period, token]);

    if (loading && !data)
        return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
    if (error) return <div className="card p-4 text-pink bg-pink/10">{error}</div>;
    if (!data) return null;

    const { summary, courses } = data;

    if (courses.length === 0) {
        return (
            <div className="card p-10 text-center text-white/40">
                Нет данных по курсам
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Переключатель периода */}
            <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-bold text-lg">📉 Воронка прохождения курсов</div>
                <div className="flex gap-2 flex-wrap">
                    {[
                        ['all', 'Всё время'],
                        [30, '30 дн.'],
                        [90, '90 дн.'],
                        [180, '180 дн.'],
                    ].map(([p, label]) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`chip ${
                                period === p ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Сводные карточки */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    icon="🎓"
                    label="Курсов"
                    value={summary.totalCourses}
                />
                <StatCard
                    icon="👥"
                    label="Всего записей"
                    value={summary.totalEnrolled}
                />
                <StatCard
                    icon="🏆"
                    label="Сертификатов"
                    value={summary.totalCertificates}
                />
                <StatCard
                    icon="📊"
                    label="Средний % завершения"
                    value={`${summary.avgCompletion}%`}
                    accent={summary.avgCompletion < 20 ? 'red' : summary.avgCompletion < 50 ? 'amber' : 'green'}
                />
            </div>

            {/* Топ-5 провалов */}
            {summary.worstDropoffs.length > 0 && (
                <div className="card p-5">
                    <div className="font-bold mb-3">⚠️ Где чаще всего бросают</div>
                    <div className="text-xs text-white/40 mb-3">
                        Самые крупные обрывы в воронке по всей платформе
                    </div>
                    <div className="space-y-2">
                        {summary.worstDropoffs.map((d, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                            >
                                <div className="w-8 h-8 grid place-items-center rounded-full bg-pink/20 text-pink text-sm font-bold shrink-0">
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                        {d.courseTitle}
                                    </div>
                                    <div className="text-xs text-white/50 truncate">
                                        после урока {d.fromOrder} «{d.fromTitle}»
                                        {' → '}урок {d.toOrder}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-pink font-bold">
                                        −{d.dropoff}
                                    </div>
                                    <div className="text-[10px] text-white/40">
                                        {d.dropoffPercent}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Топ курсов по завершению */}
            {summary.topByCompletion.length > 0 && (
                <div className="card p-5">
                    <div className="font-bold mb-3">🥇 Лучшие по завершению</div>
                    <div className="space-y-2">
                        {summary.topByCompletion.map((c) => (
                            <div
                                key={c.courseId}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                        {c.title}
                                    </div>
                                    <div className="text-xs text-white/50">
                                        {c.certificatesIssued} из {c.totalEnrolled}
                                    </div>
                                </div>
                                <div className="text-lime font-bold shrink-0">
                                    {c.completionRate}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Воронки по курсам */}
            <div className="space-y-3">
                <div className="text-lg font-bold">Все курсы</div>
                {courses.map((c) => (
                    <CourseFunnel
                        key={c.courseId}
                        course={c}
                        expanded={expandedCourseId === c.courseId}
                        onToggle={() =>
                            setExpandedCourseId(
                                expandedCourseId === c.courseId ? null : c.courseId
                            )
                        }
                    />
                ))}
            </div>
        </div>
    );
}

/* ─── Карточка-статистика ─── */
function StatCard({ icon, label, value, accent }) {
    const color =
        accent === 'red'
            ? 'text-pink'
            : accent === 'amber'
                ? 'text-amber-300'
                : accent === 'green'
                    ? 'text-lime'
                    : 'text-white';
    return (
        <div className="card p-4">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-white/50">{label}</div>
        </div>
    );
}

/* ─── Воронка одного курса ─── */
function CourseFunnel({ course, expanded, onToggle }) {
    const total = course.totalEnrolled;

    return (
        <div className="card p-4">
            {/* Шапка курса */}
            <button
                onClick={onToggle}
                className="w-full flex items-start justify-between gap-3 text-left"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold truncate">{course.title}</span>
                        {!course.published && (
                            <span className="chip bg-white/10 text-white/60 text-[10px]">
                                черновик
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-white/50 flex flex-wrap gap-x-4 gap-y-1">
                        <span>👥 {total} записались</span>
                        <span>🏆 {course.certificatesIssued} сертификатов</span>
                        <span className={course.completionRate < 20 ? 'text-pink' : ''}>
                            📊 {course.completionRate}% завершили
                        </span>
                        <span>📖 {course.lessonsTotal} уроков</span>
                    </div>
                </div>
                <div className="text-white/40 shrink-0">
                    {expanded ? '▲' : '▼'}
                </div>
            </button>

            {/* Мини-полоска прогресса */}
            {total > 0 && (
                <div className="mt-3">
                    <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                        {course.lessons.map((l, i) => {
                            const widthPct = (l.theoryPassed / total) * 100;
                            return (
                                <div
                                    key={i}
                                    className="h-full transition-all"
                                    style={{
                                        width: `${(100 / course.lessonsTotal).toFixed(3)}%`,
                                        padding: '0 1px',
                                    }}
                                    title={`Урок ${l.order}: ${l.theoryPassed} из ${total}`}
                                >
                                    <div
                                        className="h-full rounded-sm"
                                        style={{
                                            width: `${Math.min(100, widthPct)}%`,
                                            background:
                                                i === 0
                                                    ? '#A78BFA'
                                                    : i < course.lessonsTotal / 2
                                                        ? '#7C3AED'
                                                        : i < course.lessonsTotal - 1
                                                            ? '#EC4899'
                                                            : '#84CC16',
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Развёрнутая воронка */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    {course.lessons.map((l) => {
                        const pct =
                            total > 0 ? Math.round((l.theoryPassed / total) * 100) : 0;
                        const reachedPct =
                            total > 0 ? Math.round((l.reached / total) * 100) : 0;
                        return (
                            <div
                                key={l.order}
                                className="p-3 rounded-xl bg-white/[0.03] border border-white/5"
                            >
                                <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                                    <div className="text-sm font-medium truncate flex-1 min-w-0">
                                        <span className="text-white/40 mr-2">
                                            {l.order}.
                                        </span>
                                        {l.title}
                                    </div>
                                    <div className="text-xs text-white/60 shrink-0">
                                        <span className="text-white font-bold">
                                            {l.theoryPassed}
                                        </span>
                                        {' / '}
                                        {total}
                                        <span className="text-white/40 ml-1">
                                            ({pct}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Полоска reached → theoryPassed */}
                                <div className="relative h-5 rounded-md bg-white/5 overflow-hidden">
                                    {/* reached */}
                                    <div
                                        className="absolute inset-y-0 left-0 bg-white/10"
                                        style={{ width: `${reachedPct}%` }}
                                        title={`Дошло до урока: ${l.reached} (${reachedPct}%)`}
                                    />
                                    {/* theoryPassed */}
                                    <div
                                        className="absolute inset-y-0 left-0 bg-violet-soft/60"
                                        style={{ width: `${pct}%` }}
                                        title={`Прошло урок: ${l.theoryPassed} (${pct}%)`}
                                    />
                                    <div className="absolute inset-0 flex items-center px-2 text-[10px] text-white/70">
                                        {l.stuck > 0 && (
                                            <span>
                                                ⚠️ застряли: {l.stuck}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Доп. метрики: практика, ДЗ */}
                                {(l.hasPractical || l.hasHomework) && (
                                    <div className="flex gap-3 mt-2 text-[11px] text-white/50 flex-wrap">
                                        {l.hasPractical && (
                                            <span>
                                                🎯 практика:{' '}
                                                <b className="text-white/80">
                                                    {l.practicalPassed ?? 0}
                                                </b>
                                                {total > 0 && (
                                                    <span className="text-white/40 ml-1">
                                                        (
                                                        {Math.round(
                                                            ((l.practicalPassed ?? 0) /
                                                                total) *
                                                            100
                                                        )}
                                                        %)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        {l.hasHomework && (
                                            <span>
                                                📋 ДЗ:{' '}
                                                <b className="text-white/80">
                                                    {l.homeworkApproved ?? 0}
                                                </b>
                                                {total > 0 && (
                                                    <span className="text-white/40 ml-1">
                                                        (
                                                        {Math.round(
                                                            ((l.homeworkApproved ?? 0) /
                                                                total) *
                                                            100
                                                        )}
                                                        %)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Топ-3 отвала по этому курсу */}
                    {course.topDropoffs.some((d) => d.dropoff > 0) && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="text-xs text-white/50 mb-2">
                                🔻 Крупнейшие отвалы:
                            </div>
                            <div className="space-y-1">
                                {course.topDropoffs
                                    .filter((d) => d.dropoff > 0)
                                    .map((d, i) => (
                                        <div
                                            key={i}
                                            className="text-xs flex items-center gap-2 flex-wrap"
                                        >
                                            <span className="text-white/60">
                                                после урока {d.fromOrder}
                                            </span>
                                            <span className="text-pink font-medium">
                                                −{d.dropoff} ({d.dropoffPercent}%)
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}