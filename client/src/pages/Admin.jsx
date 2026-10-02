import { useEffect, useRef, useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    LineChart,
    Line,
} from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useSettings } from '../store/settings.jsx';
import ChangePasswordModal from '../components/ChangePasswordModal.jsx';

/* ──────────────────────────── Константы ──────────────────────────── */

const TABS = [
    ['dash', 'Дашборд', '📊'],
    ['analytics', 'Аналитика', '📈'],
    ['users', 'Пользователи', '👥'],
    ['courses', 'Курсы', '📚'],
    ['wiki', 'Wiki', '📖'],
    ['certificates', 'Сертификаты', '🏆'],
    ['broadcast', 'Рассылки', '📢'],
    ['push', 'Push-уведомления', '🔔'],
    ['bulk', 'Пакетные действия', '🛠'],
    ['site', 'Дизайн сайта', '🎨'],
    ['backups', 'Бэкапы', '🗄️'],
    ['settings', 'Система', '⚙️'],
];

const TEMPLATES = [
    { v: 'gradient', l: 'Градиент' },
    { v: 'classic', l: 'Классика (кремовый)' },
    { v: 'dark', l: 'Тёмный' },
    { v: 'minimal', l: 'Минимализм (белый)' },
];

const QUESTION_TYPES = [
    { v: 'single', l: 'Один ответ' },
    { v: 'multiple', l: 'Несколько' },
    { v: 'matching', l: 'Соответствие' },
    { v: 'text', l: 'Текст' },
    { v: 'order', l: 'Порядок' },
];

const CURRICULUM_TEMPLATE = [
    {
        slug: 'primer-kursa',
        title: 'Пример курса',
        description: 'Демонстрационный курс.',
        category: 'photo',
        level: 'beginner',
        published: true,
        lessons: [
            {
                title: 'Урок 1. Введение',
                content: 'Текст первого урока.',
                videoUrl: null,
                order: 1,
                duration: 15,
                test: {
                    title: 'Тест: Введение',
                    passScore: 70,
                    questions: [
                        { type: 'single', text: 'Пример?', payload: { options: ['A', 'B'], correct: 0 }, points: 1 },
                    ],
                },
            },
        ],
    },
];

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* ──────────────────────────── Корневой компонент ──────────────────────────── */

export default function Admin() {
    const { token } = useAuth();
    const { reload: reloadSettings } = useSettings();
    const [tab, setTab] = useState('dash');
    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [settings, setSettings] = useState({});
    const [editingCourse, setEditingCourse] = useState(null);

    const reloadAll = () => {
        api('/admin/stats', { token }).then(setStats).catch(() => {});
        api('/admin/users', { token }).then(setUsers).catch(() => {});
        api('/admin/courses', { token }).then(setCourses).catch(() => {});
        api('/admin/certificates', { token }).then(setCertificates).catch(() => {});
        api('/admin/settings', { token }).then(setSettings).catch(() => {});
    };

    useEffect(() => {
        reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="p-5 md:p-10 max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-6">⚙️ Админ-панель</h1>

            <div className="flex gap-2 mb-6 flex-wrap">
                {TABS.map(([k, l, i]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`chip ${
                            tab === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                        }`}
                    >
                        {i} {l}
                    </button>
                ))}
            </div>

            {tab === 'dash' && (
                <Dashboard stats={stats} token={token} onReload={reloadAll} />
            )}
            {tab === 'analytics' && <AnalyticsTab token={token} />}
            {tab === 'users' && (
                <UsersTab users={users} setUsers={setUsers} token={token} />
            )}
            {tab === 'courses' && (
                <CoursesTab
                    courses={courses}
                    setCourses={setCourses}
                    token={token}
                    onEdit={(c) => setEditingCourse({ mode: c ? 'edit' : 'create', data: c })}
                />
            )}
            {tab === 'wiki' && <WikiAdminTab token={token} />}
            {tab === 'certificates' && (
                <CertificatesTab
                    certificates={certificates}
                    setCertificates={setCertificates}
                    users={users}
                    courses={courses}
                    token={token}
                />
            )}
            {tab === 'broadcast' && (
                <BroadcastTab token={token} users={users} courses={courses} />
            )}
            {tab === 'push' && (
                <PushAdminTab token={token} users={users} courses={courses} />
            )}
            {tab === 'bulk' && (
                <BulkTab token={token} users={users} courses={courses} onReload={reloadAll} />
            )}
            {tab === 'site' && (
                <SiteDesignTab
                    settings={settings}
                    setSettings={setSettings}
                    token={token}
                    onSaved={() => { reloadSettings(); }}
                />
            )}
            {tab === 'backups' && <BackupsTab token={token} />}
            {tab === 'settings' && (
                <SettingsTab settings={settings} setSettings={setSettings} token={token} />
            )}

            {editingCourse && (
                <CourseEditor
                    course={editingCourse.data}
                    token={token}
                    onClose={() => setEditingCourse(null)}
                    onSaved={() => {
                        setEditingCourse(null);
                        reloadAll();
                    }}
                />
            )}
        </div>
    );
}

/* ──────────────────────────── Дашборд ──────────────────────────── */

function Dashboard({ stats, token, onReload }) {
    const [scan, setScan] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [lastCleanup, setLastCleanup] = useState(null);
    const [error, setError] = useState('');

    const runScan = async () => {
        setScanning(true);
        setError('');
        try {
            const r = await api('/admin/maintenance/scan', { token });
            setScan(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        runScan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runCleanup = async () => {
        if (!scan || scan.totalProblems === 0) return;
        if (
            !confirm(
                `Найдено ${scan.totalProblems} проблем. Очистить?\n\nЭто удалит только неконсистентные данные.`
            )
        )
            return;

        setCleaning(true);
        setError('');
        try {
            const r = await api('/admin/maintenance/cleanup', { method: 'POST', token });
            setLastCleanup(r);
            setScan(r.scan);
            onReload?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setCleaning(false);
        }
    };

    const cards = [
        ['Пользователи', stats.users, '👥'],
        ['Живые чаты', stats.chats, '💬'],
        ['Сообщения', stats.messages, '✉️'],
        ['Курсы', stats.courses, '📚'],
        ['Записей на курсы', stats.enrollments, '🎓'],
        ['Сертификаты', stats.certificates, '🏆'],
    ];

    const problems = scan?.categories?.filter((c) => c.count > 0) ?? [];
    const cleanCategories = scan?.categories?.filter((c) => c.count === 0) ?? [];

    return (
        <div className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(([l, v, i]) => (
                    <div key={l} className="card p-5">
                        <div className="text-3xl mb-2">{i}</div>
                        <div className="text-3xl font-bold">{v ?? '—'}</div>
                        <div className="text-sm text-white/50">{l}</div>
                    </div>
                ))}
            </div>

            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div className="flex-1 min-w-[220px]">
                        <div className="font-bold text-lg">🧹 Обслуживание базы данных</div>
                        <div className="text-sm text-white/50 mt-1">
                            Автоматически находит и удаляет неконсистентные данные.
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={runScan} disabled={scanning || cleaning} className="btn-ghost">
                            {scanning ? '⏳ Сканирую…' : '🔍 Проверить'}
                        </button>
                        <button
                            onClick={runCleanup}
                            disabled={cleaning || scanning || !scan || scan.totalProblems === 0}
                            className={`${scan?.totalProblems > 0 ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {cleaning
                                ? '⏳ Чищу…'
                                : scan?.totalProblems > 0
                                    ? `🧹 Обслужить всё (${scan.totalProblems})`
                                    : '✓ Всё чисто'}
                        </button>
                    </div>
                </div>

                {scan && (
                    <div
                        className={`rounded-2xl p-4 ${
                            scan.clean
                                ? 'bg-lime/10 border border-lime/30'
                                : 'bg-orange-500/10 border border-orange-500/30'
                        }`}
                    >
                        {scan.clean ? (
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">✅</div>
                                <div>
                                    <div className="font-bold text-lime">Всё чисто</div>
                                    <div className="text-xs text-white/50 mt-0.5">
                                        Проверено {new Date(scan.checkedAt).toLocaleString('ru-RU')}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="text-3xl">⚠️</div>
                                    <div>
                                        <div className="font-bold text-orange-300">
                                            Найдено проблем: {scan.totalProblems}
                                        </div>
                                        <div className="text-xs text-white/50 mt-0.5">
                                            Категорий с проблемами: {problems.length} из {scan.categories.length}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {problems.map((c) => (
                                        <div
                                            key={c.key}
                                            className="flex items-center justify-between gap-3 bg-ink-700/50 rounded-xl px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold">{c.label}</div>
                                                {c.hint && (
                                                    <div className="text-xs text-white/40 truncate">{c.hint}</div>
                                                )}
                                            </div>
                                            <span className="chip bg-pink/20 text-pink shrink-0">{c.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {cleanCategories.length > 0 && (
                            <details className="mt-3">
                                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                                    Что проверялось ({scan.categories.length} категорий)
                                </summary>
                                <div className="mt-2 grid sm:grid-cols-2 gap-1 text-xs">
                                    {cleanCategories.map((c) => (
                                        <div key={c.key} className="flex items-center gap-2 text-white/50">
                                            <span className="text-lime">✓</span>
                                            <span className="truncate">{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mt-3 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>
                )}

                {lastCleanup && (
                    <div className="mt-3 text-sm bg-violet/10 border border-violet/30 rounded-xl p-4">
                        <div className="font-bold text-violet-soft mb-2">✓ Обслуживание выполнено</div>
                        <div className="text-white/70">
                            Всего исправлено: <b>{lastCleanup.totalFixed}</b>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ──────────────────────────── Аналитика ──────────────────────────── */

function AnalyticsTab({ token }) {
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

    if (loading && !data)
        return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
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
                            className={`chip ${
                                period === p ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                            }`}
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
                            <Tooltip
                                contentStyle={{
                                    background: '#171728',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                name="Регистрации"
                                stroke="#A78BFA"
                                strokeWidth={2}
                                fill="url(#regGrad)"
                            />
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
                            <Tooltip
                                contentStyle={{
                                    background: '#171728',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                }}
                            />
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
                                    <Tooltip
                                        contentStyle={{
                                            background: '#171728',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 12,
                                        }}
                                    />
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
                                        <span className="text-sm font-semibold truncate">
                                            {p.author.fullName}
                                        </span>
                                        <span className="text-[10px] text-white/40 ml-auto shrink-0">
                                            💬 {p.comments} · ❤️ {p.reactions}
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/60 line-clamp-2">
                                        {p.content || '(без текста)'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── Пользователи ──────────────────────────── */

function UsersTab({ users, setUsers, token }) {
    const [resetting, setResetting] = useState(null);

    const updateUser = async (id, patch) => {
        const u = await api(`/admin/users/${id}`, { method: 'PATCH', token, body: patch });
        setUsers((prev) => prev.map((x) => (x.id === id ? u : x)));
    };

    const deleteUser = async (id) => {
        if (!confirm('Удалить пользователя со всеми его данными?')) return;
        try {
            await api(`/admin/users/${id}`, { method: 'DELETE', token });
            setUsers((prev) => prev.filter((x) => x.id !== id));
        } catch (e) {
            alert(e.message || 'Не удалось удалить пользователя');
        }
    };

    return (
        <>
            <div className="card divide-y divide-white/5">
                {users.map((u) => (
                    <div key={u.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-[180px]">
                            <div className="font-bold">{u.fullName}</div>
                            <div className="text-xs text-white/40">
                                @{u.username} · {u.phone}
                                {u.email ? ` · ${u.email}` : ''}
                            </div>
                        </div>
                        <select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="input !py-2 !w-auto"
                        >
                            <option value="STUDENT">STUDENT</option>
                            <option value="MENTOR">MENTOR</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                            onClick={() => updateUser(u.id, { isBanned: !u.isBanned })}
                            className={`chip ${
                                u.isBanned ? 'bg-pink text-white' : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {u.isBanned ? 'разбан' : 'бан'}
                        </button>
                        <button
                            onClick={() => setResetting(u)}
                            className="chip bg-white/5 hover:bg-violet/30"
                            title="Сбросить пароль"
                        >
                            🔑
                        </button>
                        <button
                            onClick={() => deleteUser(u.id)}
                            className="chip bg-white/5 hover:bg-pink/30"
                            title="Удалить"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
                {users.length === 0 && (
                    <div className="p-6 text-center text-white/40">Пользователей пока нет</div>
                )}
            </div>

            {resetting && (
                <ChangePasswordModal
                    mode="reset"
                    userId={resetting.id}
                    userName={resetting.fullName}
                    onClose={() => setResetting(null)}
                />
            )}
        </>
    );
}

/* ──────────────────────────── Курсы ──────────────────────────── */

function CoursesTab({ courses, setCourses, token, onEdit }) {
    const [exporting, setExporting] = useState(null);

    const remove = async (id) => {
        if (!confirm('Удалить курс со всеми уроками?')) return;
        await api(`/admin/courses/${id}`, { method: 'DELETE', token });
        setCourses((prev) => prev.filter((x) => x.id !== id));
    };
    const togglePublish = async (c) => {
        const u = await api(`/admin/courses/${c.id}`, {
            method: 'PATCH',
            token,
            body: { published: !c.published },
        });
        setCourses((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...u } : x)));
    };

    const exportCourse = async (c) => {
        setExporting(c.id);
        try {
            const r = await api(`/admin/bulk/export-course/${c.id}`, { token });
            downloadJSON([r.course], `course-${c.slug}.json`);
        } catch (e) {
            alert(e.message);
        } finally {
            setExporting(null);
        }
    };

    const exportAll = async () => {
        setExporting('all');
        try {
            const r = await api('/admin/bulk/export-all-courses', { token });
            downloadJSON(r.courses, `mrr-courses-${new Date().toISOString().slice(0, 10)}.json`);
        } catch (e) {
            alert(e.message);
        } finally {
            setExporting(null);
        }
    };

    return (
        <div>
            <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => onEdit(null)} className="btn-primary">
                    ＋ Создать курс
                </button>
                <button
                    onClick={exportAll}
                    disabled={exporting === 'all' || courses.length === 0}
                    className="btn-ghost"
                >
                    {exporting === 'all' ? '⏳…' : '⬇ Экспорт всех курсов'}
                </button>
            </div>
            <div className="card divide-y divide-white/5">
                {courses.map((c) => (
                    <div key={c.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <div className="font-bold">{c.title}</div>
                            <div className="text-xs text-white/40">
                                /{c.slug} · {c.category} · {c.lessons?.length || 0} уроков ·{' '}
                                {c._count?.enrollments || 0} студентов ·{' '}
                                {c._count?.certificates || 0} сертиф.
                                {c.dripMode && (
                                    <span className="ml-2 text-violet-soft">
                                        · drip:
                                        {c.dripMode === 'test' ? 'по тестам' : `кажд. ${c.dripInterval || 7} дн.`}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => togglePublish(c)}
                            className={`chip ${c.published ? 'bg-lime text-black' : 'bg-white/10'}`}
                        >
                            {c.published ? 'опубликован' : 'черновик'}
                        </button>
                        <button
                            onClick={() => exportCourse(c)}
                            disabled={exporting === c.id}
                            className="chip bg-white/5 hover:bg-white/10"
                            title="Экспорт курса в JSON"
                        >
                            {exporting === c.id ? '⏳' : '⬇ JSON'}
                        </button>
                        <button
                            onClick={() => onEdit(c)}
                            className="chip bg-violet/30 hover:bg-violet/50"
                        >
                            ✏️ Редактировать
                        </button>
                        <button
                            onClick={() => remove(c.id)}
                            className="chip bg-white/5 hover:bg-pink/30"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
                {courses.length === 0 && (
                    <div className="p-6 text-center text-white/40">Курсов пока нет</div>
                )}
            </div>
        </div>
    );
}

/* ──────────────────────────── CourseEditor ──────────────────────────── */

function CourseEditor({ course, token, onClose, onSaved }) {
    const isNew = !course;
    const [form, setForm] = useState(() => ({
        title: course?.title || '',
        slug: course?.slug || '',
        description: course?.description || '',
        category: course?.category || 'photo',
        level: course?.level || 'beginner',
        cover: course?.cover || '',
        published: course?.published ?? false,
        certificateTitle: course?.certificateTitle || 'Сертификат о прохождении курса',
        certificateDescription: course?.certificateDescription || '',
        dripMode: course?.dripMode || '',
        dripInterval: course?.dripInterval ?? 7,
    }));
    const [lessons, setLessons] = useState(course?.lessons || []);
    const [savedCourse, setSavedCourse] = useState(course || null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [busy, setBusy] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const saveCourse = async () => {
        setBusy(true);
        try {
            let saved;
            const payload = {
                ...form,
                dripMode: form.dripMode || null,
                dripInterval:
                    form.dripMode === 'schedule' ? Number(form.dripInterval) || 7 : null,
            };

            if (isNew || !savedCourse) {
                const slug =
                    form.slug ||
                    form.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30) +
                    '-' +
                    Date.now().toString(36);
                saved = await api('/admin/courses', {
                    method: 'POST',
                    token,
                    body: { ...payload, slug },
                });
            } else {
                saved = await api(`/admin/courses/${savedCourse.id}`, {
                    method: 'PATCH',
                    token,
                    body: payload,
                });
            }
            const full = await api(`/admin/courses/${saved.id}`, { token });
            setSavedCourse(full);
            setLessons(full.lessons || []);
            setForm((f) => ({ ...f, slug: full.slug }));
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const addLesson = async () => {
        if (!savedCourse) {
            alert('Сначала сохрани курс');
            return;
        }
        const lesson = await api(`/admin/courses/${savedCourse.id}/lessons`, {
            method: 'POST',
            token,
            body: {
                title: 'Новый урок',
                content: '',
                order: lessons.length + 1,
                duration: 0,
            },
        });
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
        setActiveLesson(full.lessons.find((l) => l.id === lesson.id));
    };

    const refreshLessons = async () => {
        if (!savedCourse) return;
        const full = await api(`/admin/courses/${savedCourse.id}`, { token });
        setLessons(full.lessons);
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6"
            onClick={onClose}
        >
            <div
                className="card max-w-5xl mx-auto my-4 p-5 md:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">
                        {isNew ? 'Новый курс' : `Курс: ${savedCourse?.title || form.title}`}
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
                        ✕
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-6">
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Название</label>
                        <input className="input" value={form.title} onChange={set('title')} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Slug (URL)</label>
                        <input className="input" value={form.slug} onChange={set('slug')} placeholder="auto" />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Категория</label>
                        <select className="input" value={form.category} onChange={set('category')}>
                            <option value="photo">📸 Фото</option>
                            <option value="video">🎥 Видео</option>
                            <option value="radio">📻 Радио</option>
                            <option value="sound">🎚️ Звук</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Уровень</label>
                        <select className="input" value={form.level} onChange={set('level')}>
                            <option value="beginner">beginner</option>
                            <option value="intermediate">intermediate</option>
                            <option value="advanced">advanced</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Обложка (URL)</label>
                        <input className="input" value={form.cover} onChange={set('cover')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Описание</label>
                        <textarea rows={2} className="input resize-none" value={form.description} onChange={set('description')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Заголовок сертификата</label>
                        <input className="input" value={form.certificateTitle} onChange={set('certificateTitle')} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-white/40 uppercase block mb-1">Описание сертификата</label>
                        <textarea rows={2} className="input resize-none" value={form.certificateDescription} onChange={set('certificateDescription')} />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Drip-режим</label>
                        <select className="input" value={form.dripMode} onChange={(e) => setForm((f) => ({ ...f, dripMode: e.target.value }))}>
                            <option value="">Открыт сразу</option>
                            <option value="test">После теста (по порядку)</option>
                            <option value="schedule">По расписанию</option>
                        </select>
                    </div>
                    {form.dripMode === 'schedule' && (
                        <div>
                            <label className="text-xs text-white/40 uppercase block mb-1">
                                Интервал (дней между уроками)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                className="input"
                                value={form.dripInterval}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, dripInterval: Number(e.target.value) || 7 }))
                                }
                            />
                        </div>
                    )}

                    <label className="flex items-center gap-2 md:col-span-2">
                        <input
                            type="checkbox"
                            checked={form.published}
                            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                        />
                        Опубликован
                    </label>
                </div>

                <div className="flex gap-3 justify-end mb-6">
                    <button onClick={saveCourse} disabled={busy} className="btn-primary">
                        {busy ? 'Сохранение…' : isNew ? 'Создать курс' : 'Сохранить курс'}
                    </button>
                </div>

                {savedCourse && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold">Уроки ({lessons.length})</h3>
                            <button onClick={addLesson} className="btn-ghost !py-2 text-sm">
                                ＋ Добавить урок
                            </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                                {lessons.map((l, i) => (
                                    <button
                                        key={l.id}
                                        onClick={() => setActiveLesson(l)}
                                        className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${
                                            activeLesson?.id === l.id ? 'bg-white/10' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="w-7 h-7 grid place-items-center rounded-full bg-white/10 text-xs font-bold">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold truncate">{l.title}</div>
                                            <div className="text-xs text-white/40">
                                                {l.duration} мин ·{' '}
                                                {l.test ? `${l.test.questions?.length || 0} вопр.` : 'без теста'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {lessons.length === 0 && (
                                    <div className="text-white/40 text-sm p-3">Уроков нет</div>
                                )}
                            </div>
                            <div>
                                {activeLesson ? (
                                    <LessonEditor
                                        key={activeLesson.id}
                                        lesson={activeLesson}
                                        token={token}
                                        onDeleted={() => {
                                            setActiveLesson(null);
                                            refreshLessons();
                                        }}
                                        onSaved={() => refreshLessons()}
                                    />
                                ) : (
                                    <div className="card p-6 text-center text-white/40 text-sm">
                                        Выбери урок слева
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!savedCourse && (
                    <div className="text-center text-white/40 text-sm py-3">
                        Сохрани курс, чтобы добавлять уроки
                    </div>
                )}

                <div className="flex justify-end mt-6">
                    <button onClick={onSaved} className="btn-primary">
                        Готово
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── LessonEditor ──────────────────────────── */

function LessonEditor({ lesson, token, onSaved, onDeleted }) {
    const [form, setForm] = useState({
        title: lesson.title,
        content: lesson.content || '',
        videoUrl: lesson.videoUrl || '',
        order: lesson.order ?? 0,
        duration: lesson.duration ?? 0,
    });
    const [test, setTest] = useState(lesson.test || null);
    const [busy, setBusy] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        setBusy(true);
        try {
            await api(`/admin/lessons/${lesson.id}`, {
                method: 'PATCH',
                token,
                body: {
                    title: form.title,
                    content: form.content,
                    videoUrl: form.videoUrl || null,
                    order: Number(form.order) || 0,
                    duration: Number(form.duration) || 0,
                },
            });
            onSaved?.();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Удалить урок?')) return;
        await api(`/admin/lessons/${lesson.id}`, { method: 'DELETE', token });
        onDeleted?.();
    };

    const createTest = async () => {
        const t = await api(`/admin/lessons/${lesson.id}/test`, {
            method: 'POST',
            token,
            body: { title: `Тест: ${form.title}`, passScore: 70 },
        });
        setTest({ ...t, questions: [] });
    };

    const deleteTest = async () => {
        if (!confirm('Удалить тест?')) return;
        await api(`/admin/tests/${test.id}`, { method: 'DELETE', token });
        setTest(null);
    };

    return (
        <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-bold">Урок</div>
                <button onClick={remove} className="chip bg-white/5 hover:bg-pink/30 text-xs">
                    🗑️
                </button>
            </div>
            <input className="input" value={form.title} onChange={set('title')} placeholder="Название" />
            <textarea rows={5} className="input resize-none" value={form.content} onChange={set('content')} placeholder="Содержимое урока" />
            <input className="input" value={form.videoUrl} onChange={set('videoUrl')} placeholder="URL видео (необязательно)" />
            <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input" value={form.order} onChange={set('order')} placeholder="Порядок" />
                <input type="number" className="input" value={form.duration} onChange={set('duration')} placeholder="Длительность (мин)" />
            </div>
            <button onClick={save} disabled={busy} className="btn-primary w-full">
                {busy ? 'Сохранение…' : 'Сохранить урок'}
            </button>
            <div className="pt-3 border-t border-white/10">
                {!test ? (
                    <button onClick={createTest} className="btn-ghost w-full text-sm">
                        ＋ Создать тест
                    </button>
                ) : (
                    <TestEditor test={test} setTest={setTest} token={token} onDelete={deleteTest} />
                )}
            </div>
        </div>
    );
}

/* ──────────────────────────── TestEditor ──────────────────────────── */

function TestEditor({ test, setTest, token, onDelete }) {
    const [title, setTitle] = useState(test.title);
    const [passScore, setPassScore] = useState(test.passScore);
    const [questions, setQuestions] = useState(test.questions || []);

    const saveMeta = async () => {
        await api(`/admin/tests/${test.id}`, {
            method: 'PATCH',
            token,
            body: { title, passScore: Number(passScore) || 70 },
        });
    };

    const addQuestion = async () => {
        const q = await api(`/admin/tests/${test.id}/questions`, {
            method: 'POST',
            token,
            body: {
                type: 'single',
                text: 'Новый вопрос',
                payload: { options: ['Вариант 1', 'Вариант 2'], correct: 0 },
                points: 1,
            },
        });
        setQuestions((prev) => [...prev, q]);
    };

    const updateQuestion = async (id, patch) => {
        const updated = await api(`/admin/questions/${id}`, {
            method: 'PATCH',
            token,
            body: patch,
        });
        setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    };

    const removeQuestion = async (id) => {
        if (!confirm('Удалить вопрос?')) return;
        await api(`/admin/questions/${id}`, { method: 'DELETE', token });
        setQuestions((prev) => prev.filter((q) => q.id !== id));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-bold">🎯 Тест</div>
                <button onClick={onDelete} className="chip bg-white/5 hover:bg-pink/30 text-xs">
                    Удалить тест
                </button>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-2">
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input type="number" className="input" value={passScore} onChange={(e) => setPassScore(e.target.value)} />
            </div>
            <button onClick={saveMeta} className="btn-ghost w-full text-sm">Сохранить тест</button>

            <div className="flex items-center justify-between pt-2">
                <div className="text-sm font-bold">Вопросы ({questions.length})</div>
                <button onClick={addQuestion} className="chip bg-violet/30 hover:bg-violet/50 text-xs">
                    ＋ Вопрос
                </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {questions.map((q, i) => (
                    <QuestionEditor
                        key={q.id}
                        index={i}
                        question={q}
                        onUpdate={(patch) => updateQuestion(q.id, patch)}
                        onDelete={() => removeQuestion(q.id)}
                    />
                ))}
                {questions.length === 0 && (
                    <div className="text-center text-white/40 text-sm py-3">Вопросов нет</div>
                )}
            </div>
        </div>
    );
}

/* ──────────────────────────── QuestionEditor ──────────────────────────── */

function QuestionEditor({ question, index, onUpdate, onDelete }) {
    const [type, setType] = useState(question.type || 'single');
    const [text, setText] = useState(question.text);
    const [payload, setPayload] = useState(() => {
        try { return JSON.parse(question.payload || '{}'); } catch { return {}; }
    });
    const [points, setPoints] = useState(question.points);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await onUpdate({ type, text, payload, points: Number(points) || 1 });
        } catch (e) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const changeType = (newType) => {
        setType(newType);
        setPayload(defaultPayload(newType, payload));
    };

    return (
        <div className="card p-3">
            <div className="flex items-start gap-2">
                <button onClick={() => setOpen((o) => !o)} className="text-white/50 text-xs mt-1">
                    {open ? '▼' : '▶'}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{index + 1}. {text}</div>
                    <div className="text-xs text-white/40 truncate">
                        {QUESTION_TYPES.find((x) => x.v === type)?.l || type} · {points} б.
                    </div>
                </div>
                <button onClick={onDelete} className="text-xs text-white/40 hover:text-pink">✕</button>
            </div>
            {open && (
                <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                        <textarea rows={2} className="input resize-none text-sm" value={text} onChange={(e) => setText(e.target.value)} />
                        <div className="flex flex-col gap-2">
                            <select className="input !py-2 text-sm" value={type} onChange={(e) => changeType(e.target.value)}>
                                {QUESTION_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                            </select>
                            <input type="number" className="input !py-2 text-sm" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Баллы" />
                        </div>
                    </div>
                    <PayloadEditor type={type} payload={payload} setPayload={setPayload} />
                    <div className="flex gap-2">
                        <button onClick={save} disabled={saving} className="chip bg-violet text-white text-xs">
                            {saving ? '…' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function defaultPayload(type, old = {}) {
    if (type === 'single') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: 0 };
    if (type === 'multiple') return { options: old.options || ['Вариант 1', 'Вариант 2'], correct: [] };
    if (type === 'matching') return { left: old.left || ['A', 'B'], right: old.right || ['1', '2'], pairs: old.pairs || [[0, 0], [1, 1]] };
    if (type === 'text') return { answer: old.answer || '', caseSensitive: old.caseSensitive ?? false };
    if (type === 'order') return { items: old.items || ['Первый', 'Второй', 'Третий'] };
    return {};
}

function PayloadEditor({ type, payload, setPayload }) {
    const set = (k, v) => setPayload({ ...payload, [k]: v });

    if (type === 'single') {
        const opts = payload.options || [];
        return (
            <div className="space-y-2">
                <div className="text-xs text-white/40">Отметьте правильный вариант</div>
                {opts.map((o, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input type="radio" checked={payload.correct === idx} onChange={() => set('correct', idx)} />
                        <input className="input !py-2 text-sm" value={o}
                               onChange={(e) => set('options', opts.map((x, i) => (i === idx ? e.target.value : x)))} />
                        {opts.length > 2 && (
                            <button onClick={() => set('options', opts.filter((_, i) => i !== idx))} className="text-white/40 hover:text-pink">✕</button>
                        )}
                    </div>
                ))}
                <button onClick={() => set('options', [...opts, `Вариант ${opts.length + 1}`])} className="chip bg-white/5 text-xs">＋ Вариант</button>
            </div>
        );
    }
    if (type === 'multiple') {
        const opts = payload.options || [];
        const cur = Array.isArray(payload.correct) ? payload.correct : [];
        const toggle = (idx) => set('correct', cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]);
        return (
            <div className="space-y-2">
                <div className="text-xs text-white/40">Отметьте все правильные варианты</div>
                {opts.map((o, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input type="checkbox" checked={cur.includes(idx)} onChange={() => toggle(idx)} />
                        <input className="input !py-2 text-sm" value={o}
                               onChange={(e) => set('options', opts.map((x, i) => (i === idx ? e.target.value : x)))} />
                        {opts.length > 2 && (
                            <button onClick={() => set('options', opts.filter((_, i) => i !== idx))} className="text-white/40 hover:text-pink">✕</button>
                        )}
                    </div>
                ))}
                <button onClick={() => set('options', [...opts, `Вариант ${opts.length + 1}`])} className="chip bg-white/5 text-xs">＋ Вариант</button>
            </div>
        );
    }
    if (type === 'matching') {
        const left = payload.left || [];
        const right = payload.right || [];
        const pairs = payload.pairs || [];
        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-xs text-white/40 mb-1">Левый столбец</div>
                        {left.map((l, i) => (
                            <input key={i} className="input !py-2 text-sm mb-1" value={l}
                                   onChange={(e) => set('left', left.map((x, j) => (j === i ? e.target.value : x)))} />
                        ))}
                        <button onClick={() => set('left', [...left, 'Новый'])} className="chip bg-white/5 text-xs">＋</button>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 mb-1">Правый столбец</div>
                        {right.map((r, i) => (
                            <input key={i} className="input !py-2 text-sm mb-1" value={r}
                                   onChange={(e) => set('right', right.map((x, j) => (j === i ? e.target.value : x)))} />
                        ))}
                        <button onClick={() => set('right', [...right, 'Новый'])} className="chip bg-white/5 text-xs">＋</button>
                    </div>
                </div>
                <div className="text-xs text-white/40 mt-2">Соответствия (левый → правый)</div>
                {left.map((_, li) => {
                    const pair = pairs.find((p) => p[0] === li);
                    const val = pair ? pair[1] : '';
                    return (
                        <div key={li} className="flex gap-2 items-center">
                            <span className="text-xs w-6">{li + 1}</span>
                            <select className="input !py-2 text-sm" value={val}
                                    onChange={(e) => {
                                        const v = e.target.value === '' ? null : Number(e.target.value);
                                        const others = pairs.filter((p) => p[0] !== li);
                                        set('pairs', v === null ? others : [...others, [li, v]]);
                                    }}>
                                <option value="">—</option>
                                {right.map((_, ri) => <option key={ri} value={ri}>{ri + 1}</option>)}
                            </select>
                        </div>
                    );
                })}
            </div>
        );
    }
    if (type === 'text') {
        return (
            <div className="space-y-2">
                <input className="input !py-2 text-sm" placeholder="Правильный ответ"
                       value={payload.answer || ''} onChange={(e) => set('answer', e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!payload.caseSensitive} onChange={(e) => set('caseSensitive', e.target.checked)} />
                    Учитывать регистр
                </label>
            </div>
        );
    }
    if (type === 'order') {
        const items = payload.items || [];
        const move = (i, dir) => {
            const arr = [...items]; const j = i + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            set('items', arr);
        };
        return (
            <div className="space-y-1">
                <div className="text-xs text-white/40 mb-1">Правильный порядок (сверху вниз)</div>
                {items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <input className="input !py-2 text-sm flex-1" value={it}
                               onChange={(e) => set('items', items.map((x, j) => (j === i ? e.target.value : x)))} />
                        <button onClick={() => move(i, -1)} className="btn-ghost !p-1 text-xs">↑</button>
                        <button onClick={() => move(i, 1)} className="btn-ghost !p-1 text-xs">↓</button>
                        {items.length > 2 && (
                            <button onClick={() => set('items', items.filter((_, j) => j !== i))} className="text-white/40 hover:text-pink">✕</button>
                        )}
                    </div>
                ))}
                <button onClick={() => set('items', [...items, `Пункт ${items.length + 1}`])} className="chip bg-white/5 text-xs">＋ Пункт</button>
            </div>
        );
    }
    return null;
}

/* ──────────────────────────── Сертификаты ──────────────────────────── */

function CertificatesTab({ certificates, setCertificates, users, courses, token }) {
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
                <input className="input flex-1 min-w-[220px]" placeholder="Поиск…"
                       value={filter} onChange={(e) => setFilter(e.target.value)} />
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
                <CreateCertificateModal
                    users={users} courses={courses} token={token}
                    onClose={() => setCreating(false)}
                    onCreated={async () => { setCreating(false); await reload(); }}
                />
            )}
        </div>
    );
}

function CreateCertificateModal({ users, courses, token, onClose, onCreated }) {
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
                    value={userId} onChange={setUserId} placeholder="Начните вводить имя…"
                />
                <label className="text-xs text-white/40 uppercase mb-1 mt-4 block">Курс</label>
                <SearchSelect
                    items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                    value={courseId} onChange={setCourseId} placeholder="Начните вводить название…"
                />
                {error && <p className="text-pink text-sm mt-3">{error}</p>}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'Выдача…' : 'Выдать'}</button>
                </div>
            </div>
        </div>
    );
}

function SearchSelect({ items, value, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const selected = items.find((i) => i.id === value);
    const filtered = items.filter((i) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return i.label.toLowerCase().includes(s) || (i.sub || '').toLowerCase().includes(s);
    });
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)}
                    className="input w-full text-left flex items-center justify-between">
                {selected ? (
                    <span className="truncate">
                        {selected.label}
                        {selected.sub && <span className="text-white/40 text-xs ml-2">{selected.sub}</span>}
                    </span>
                ) : (
                    <span className="text-white/40">{placeholder}</span>
                )}
                <span className="text-white/40 ml-2">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-10 mt-1 w-full card p-2 max-h-64 overflow-y-auto">
                    <input autoFocus className="input !py-2 mb-2" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
                    {filtered.length === 0 && (
                        <div className="text-center text-white/40 text-sm py-2">Ничего не найдено</div>
                    )}
                    {filtered.map((i) => (
                        <button key={i.id} type="button"
                                onClick={() => { onChange(i.id); setOpen(false); setQ(''); }}
                                className={`w-full text-left p-2 rounded-xl hover:bg-white/5 ${i.id === value ? 'bg-violet/20' : ''}`}>
                            <div className="font-semibold text-sm">{i.label}</div>
                            {i.sub && <div className="text-xs text-white/40">{i.sub}</div>}
                        </button>
                    ))}
                </div>
            )}
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

/* ──────────────────────────── Рассылки ──────────────────────────── */

function BroadcastTab({ token, users, courses }) {
    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [courseId, setCourseId] = useState('');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        api('/admin/groups', { token }).then(setGroups).catch(() => {});
    }, [token]);

    const preview = (() => {
        if (target === 'all') return `${users.length} получателей`;
        if (target === 'direction') {
            const cnt = users.filter((u) => u.direction === direction).length;
            return `${cnt} получателей с направлением «${direction}»`;
        }
        if (target === 'course') {
            if (!courseId) return 'Выберите курс';
            const c = courses.find((x) => x.id === courseId);
            return `Все записанные на курс «${c?.title || ''}»`;
        }
        if (target === 'group') {
            if (!group) return 'Выберите группу';
            return `Группа «${group}»`;
        }
        return '';
    })();

    const send = async () => {
        if (!message.trim()) return alert('Введите текст');
        if (!confirm('Отправить рассылку?')) return;
        setBusy(true); setResult(null);
        try {
            const body = { target, message, title };
            if (target === 'direction') body.direction = direction;
            if (target === 'course') body.courseId = courseId;
            if (target === 'group') body.group = group;
            const r = await api('/admin/broadcast', { method: 'POST', token, body });
            setResult(r);
            setMessage(''); setTitle('');
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-5 space-y-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['course', '📚 По курсу'], ['group', '🎓 По группе']].map(([v, l]) => (
                            <button key={v} onClick={() => setTarget(v)}
                                    className={`chip ${target === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                        ))}
                    </div>
                </div>
                {target === 'direction' && (
                    <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                        <option value="photo">📸 Фото</option>
                        <option value="video">🎥 Видео</option>
                        <option value="radio">📻 Радио</option>
                        <option value="sound">🎚️ Звук</option>
                    </select>
                )}
                {target === 'course' && (
                    <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        <option value="">— выберите курс —</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                )}
                {target === 'group' && (
                    <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                        <option value="">— выберите группу —</option>
                        {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок</label>
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Сообщение от администрации" />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Текст</label>
                    <textarea rows={5} className="input resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текст рассылки…" />
                </div>
                <div className="text-xs text-white/50">Получатели: {preview}</div>
                <button onClick={send} disabled={busy} className="btn-primary w-full">
                    {busy ? 'Отправка…' : '📢 Отправить рассылку'}
                </button>
                {result && <div className="card p-3 text-sm text-lime bg-lime/10">✓ Доставлено {result.delivered} получателям</div>}
            </div>
            <div className="card p-5">
                <div className="text-xs text-white/40 uppercase mb-2">Как выглядит</div>
                <div className="rounded-2xl bg-ink-700/70 p-4 border border-white/5">
                    <div className="text-sm font-bold mb-1">📢 {title || 'Сообщение от администрации'}</div>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">{message || 'Здесь будет текст…'}</div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── Пакетные действия ──────────────────────────── */

function BulkTab({ token, users, courses, onReload }) {
    const [lastResult, setLastResult] = useState(null);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const [actions, setActions] = useState([]);

    const loadActions = () => {
        api('/admin/bulk/actions?limit=50', { token })
            .then(setActions)
            .catch(() => {});
    };

    useEffect(() => {
        loadActions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = async (endpoint, body, label) => {
        if (label && !confirm(`${label}\n\nПродолжить?`)) return;
        setBusy(endpoint);
        setError('');
        setLastResult(null);
        try {
            const r = await api(endpoint, { method: 'POST', token, body });
            setLastResult({ endpoint, ...r });
            loadActions();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="card p-5">
                <div className="font-bold text-lg mb-1">🛠 Пакетные действия</div>
                <div className="text-sm text-white/50 mb-4">
                    Операции выполняются явно по кнопке, логируются в журнале и не создают дублей.
                </div>

                {error && (
                    <div className="mb-4 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>
                )}

                {lastResult && (
                    <div className="mb-4 text-sm bg-lime/10 border border-lime/30 rounded-xl p-4">
                        <div className="font-bold text-lime mb-1">✓ Операция выполнена</div>
                        <pre className="text-xs text-white/70 whitespace-pre-wrap">
                            {JSON.stringify(lastResult, null, 2)}
                        </pre>
                    </div>
                )}

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        A. Восстановление и пересчёт
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => run('/admin/bulk/recalc-all', {}, 'Пересчитать прогресс ВСЕХ enrollments?')}
                            disabled={busy === '/admin/bulk/recalc-all'}
                            className="btn-ghost justify-start"
                        >
                            {busy === '/admin/bulk/recalc-all' ? '⏳…' : '🔄 Пересчитать прогресс всех'}
                        </button>
                        <button
                            onClick={() => run('/admin/bulk/issue-certificates', {}, 'Выдать сертификаты всем, у кого progress=100?')}
                            disabled={busy === '/admin/bulk/issue-certificates'}
                            className="btn-ghost justify-start"
                        >
                            {busy === '/admin/bulk/issue-certificates' ? '⏳…' : '🏆 Выдать пропущенные сертификаты'}
                        </button>
                    </div>
                    <RecalcUserCourseForm token={token} users={users} courses={courses} />
                </div>

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        B. Массовые действия с курсом
                    </div>
                    <BulkCourseAction
                        token={token}
                        courses={courses}
                        onResult={(r, ep) => { setLastResult({ endpoint: ep, ...r }); loadActions(); }}
                    />
                </div>

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        C. Импорт и экспорт курсов
                    </div>
                    <CurriculumImportForm
                        token={token}
                        onResult={(r) => {
                            setLastResult({ endpoint: '/admin/bulk/import-curriculum', ...r });
                            loadActions();
                            onReload?.();
                        }}
                    />
                </div>

                <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        D. Экспорт данных
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={async () => {
                                setBusy('/export-courses'); setError('');
                                try {
                                    const r = await api('/admin/bulk/export-all-courses', { token });
                                    downloadJSON(r.courses, `mrr-courses-${new Date().toISOString().slice(0, 10)}.json`);
                                    setLastResult({ endpoint: '/admin/bulk/export-all-courses', affected: r.affected });
                                    loadActions();
                                } catch (e) { setError(e.message); }
                                finally { setBusy(null); }
                            }}
                            disabled={busy === '/export-courses'}
                            className="btn-ghost"
                        >
                            {busy === '/export-courses' ? '⏳…' : '⬇ Все курсы (JSON)'}
                        </button>
                        <button
                            onClick={async () => {
                                setBusy('/export-snapshot'); setError('');
                                try {
                                    const r = await api('/admin/bulk/export', { method: 'POST', token });
                                    downloadJSON(r.snapshot, `mrr-snapshot-${new Date().toISOString().slice(0, 10)}.json`);
                                    setLastResult({ endpoint: '/admin/bulk/export', affected: r.affected });
                                    loadActions();
                                } catch (e) { setError(e.message); }
                                finally { setBusy(null); }
                            }}
                            disabled={busy === '/export-snapshot'}
                            className="btn-ghost"
                        >
                            {busy === '/export-snapshot' ? '⏳…' : '⬇ Полный снапшот (JSON)'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">📜 Журнал операций</div>
                    <button onClick={loadActions} className="btn-ghost !py-1.5 !px-3 text-xs">Обновить</button>
                </div>
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                    {actions.length === 0 && (
                        <div className="p-4 text-center text-white/40 text-sm">Пока пусто</div>
                    )}
                    {actions.map((a) => (
                        <div key={a.id} className="p-3 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="chip bg-violet/20 text-violet-soft text-[10px]">{a.action}</span>
                                <span className="text-white/60">{a.admin.fullName}</span>
                                <span className="text-[10px] text-white/30">
                                    {new Date(a.createdAt).toLocaleString('ru-RU')}
                                </span>
                                {a.affected > 0 && (
                                    <span className="chip bg-lime/20 text-lime text-[10px] ml-auto">+{a.affected}</span>
                                )}
                                {a.error && (
                                    <span className="chip bg-pink/20 text-pink text-[10px] ml-auto">ошибка</span>
                                )}
                            </div>
                            {a.error && <div className="text-xs text-pink/70 mt-1">{a.error}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RecalcUserCourseForm({ token, users, courses }) {
    const [userId, setUserId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const run = async () => {
        if (!userId || !courseId) return alert('Выберите студента и курс');
        setBusy(true); setResult(null);
        try {
            const r = await api('/admin/bulk/recalc-user-course', {
                method: 'POST', token, body: { userId, courseId },
            });
            setResult(r);
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="mt-3 grid md:grid-cols-3 gap-2 items-end">
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Студент</label>
                <SearchSelect
                    items={users.map((u) => ({ id: u.id, label: u.fullName, sub: `@${u.username}` }))}
                    value={userId} onChange={setUserId} placeholder="Выберите…"
                />
            </div>
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Курс</label>
                <SearchSelect
                    items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                    value={courseId} onChange={setCourseId} placeholder="Выберите…"
                />
            </div>
            <button onClick={run} disabled={busy} className="btn-ghost">
                {busy ? '⏳…' : '↺ Пересчитать'}
            </button>
            {result && <div className="text-xs text-lime md:col-span-3">Прогресс: {result.progress}%</div>}
        </div>
    );
}

function BulkCourseAction({ token, courses, onResult }) {
    const [courseId, setCourseId] = useState('');
    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/admin/groups', { token }).then(setGroups).catch(() => {});
    }, [token]);

    const run = async (endpoint, label) => {
        if (!courseId) return alert('Выберите курс');
        if (!confirm(`${label}\n\nПродолжить?`)) return;
        setBusy(endpoint);
        try {
            const body = { courseId, target };
            if (target === 'direction') body.direction = direction;
            if (target === 'group') body.group = group;
            const r = await api(endpoint, { method: 'POST', token, body });
            onResult?.(r, endpoint);
        } catch (e) { alert(e.message); }
        finally { setBusy(null); }
    };

    return (
        <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Курс</label>
                    <SearchSelect
                        items={courses.map((c) => ({ id: c.id, label: c.title, sub: c.slug }))}
                        value={courseId} onChange={setCourseId} placeholder="Выберите…"
                    />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['group', '🎓 По группе']].map(([v, l]) => (
                            <button key={v} onClick={() => setTarget(v)}
                                    className={`chip ${target === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                        ))}
                    </div>
                </div>
            </div>

            {target === 'direction' && (
                <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                    <option value="photo">📸 Фото</option>
                    <option value="video">🎥 Видео</option>
                    <option value="radio">📻 Радио</option>
                    <option value="sound">🎚️ Звук</option>
                </select>
            )}
            {target === 'group' && (
                <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                    <option value="">— выберите группу —</option>
                    {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
            )}

            <div className="grid sm:grid-cols-3 gap-2">
                <button onClick={() => run('/admin/bulk/enroll', 'Массово записать выбранных на курс?')}
                        disabled={busy === '/admin/bulk/enroll'} className="btn-ghost">
                    {busy === '/admin/bulk/enroll' ? '⏳…' : '＋ Записать на курс'}
                </button>
                <button onClick={() => run('/admin/bulk/unenroll', 'Отчислить выбранных с курса?')}
                        disabled={busy === '/admin/bulk/unenroll'} className="btn-ghost">
                    {busy === '/admin/bulk/unenroll' ? '⏳…' : '✕ Отчислить с курса'}
                </button>
                <button onClick={() => run('/admin/bulk/reset-progress', 'Обнулить прогресс выбранных по этому курсу?')}
                        disabled={busy === '/admin/bulk/reset-progress'} className="btn-ghost text-pink">
                    {busy === '/admin/bulk/reset-progress' ? '⏳…' : '↺ Обнулить прогресс'}
                </button>
            </div>
        </div>
    );
}

function CurriculumImportForm({ token, onResult }) {
    const [json, setJson] = useState('');
    const [mode, setMode] = useState('merge');
    const [preserveProgress, setPreserveProgress] = useState(false);
    const [validation, setValidation] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const parse = () => {
        try {
            const data = JSON.parse(json);
            if (!Array.isArray(data)) throw new Error('Ожидается массив курсов');
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e.message };
        }
    };

    const validate = async () => {
        setError(''); setValidation(null);
        const { data, error: parseError } = parse();
        if (parseError) { setError('Невалидный JSON: ' + parseError); return; }
        try {
            const v = await api('/admin/bulk/validate-curriculum', {
                method: 'POST', token, body: { data },
            });
            setValidation(v);
        } catch (e) { setError(e.message); }
    };

    const submit = async () => {
        setError('');
        const { data, error: parseError } = parse();
        if (parseError) { setError('Невалидный JSON: ' + parseError); return; }
        let v;
        try {
            v = await api('/admin/bulk/validate-curriculum', {
                method: 'POST', token, body: { data },
            });
        } catch (e) { setError(e.message); return; }
        setValidation(v);
        if (!v.valid) {
            setError(`В структуре найдено ${v.totalErrors} ошибок.`);
            return;
        }
        const modeLabel = mode === 'replace'
            ? `⚠️ РЕЖИМ REPLACE: все уроки и тесты курсов из JSON будут удалены.${preserveProgress ? ' Прогресс сохранится по совпадающим урокам.' : ' Прогресс студентов будет потерян.'}`
            : 'Режим MERGE: существующие обновятся, новые добавятся.';
        if (!confirm(
            `${modeLabel}\n\nКурсов: ${v.stats.courses}, уроков: ${v.stats.lessons}, тестов: ${v.stats.tests}, вопросов: ${v.stats.questions}.\n\nПродолжить?`
        )) return;

        setBusy(true);
        try {
            const r = await api('/admin/bulk/import-curriculum', {
                method: 'POST', token, body: { data, mode, preserveProgress },
            });
            onResult?.(r);
            setJson(''); setValidation(null);
        } catch (e) {
            setError(e.message);
            if (e.errors) setValidation({ valid: false, errors: e.errors, stats: e.stats });
        } finally { setBusy(false); }
    };

    const loadTemplate = () => {
        setJson(JSON.stringify(CURRICULUM_TEMPLATE, null, 2));
        setValidation(null); setError('');
    };

    const downloadTemplate = () => downloadJSON(CURRICULUM_TEMPLATE, 'curriculum-template.json');

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setJson(String(ev.target.result || ''));
            setValidation(null); setError('');
        };
        reader.onerror = () => setError('Не удалось прочитать файл');
        reader.readAsText(file);
    };

    return (
        <div className="space-y-3">
            <div className="text-xs text-white/50 leading-relaxed">
                Формат: массив курсов с уроками и тестами. Существующие курсы — по{' '}
                <code>slug</code>, уроки — по названию.
            </div>
            <div className="flex gap-2 flex-wrap">
                <button onClick={loadTemplate} className="chip bg-white/5 hover:bg-white/10">📋 Вставить шаблон</button>
                <button onClick={downloadTemplate} className="chip bg-white/5 hover:bg-white/10">⬇ Скачать шаблон</button>
                <button onClick={() => fileRef.current?.click()} className="chip bg-white/5 hover:bg-white/10">📂 Загрузить из файла</button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Режим импорта</label>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setMode('merge')}
                                className={`chip ${mode === 'merge' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>🔀 Merge</button>
                        <button onClick={() => setMode('replace')}
                                className={`chip ${mode === 'replace' ? 'bg-pink text-white' : 'bg-white/5 text-white/60'}`}>♻️ Replace</button>
                    </div>
                    <div className="text-[11px] text-white/40 mt-1">
                        {mode === 'merge' ? 'Обновляем существующие, добавляем новые.' : 'Полная замена уроков и тестов курса.'}
                    </div>
                </div>
                {mode === 'replace' && (
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Прогресс студентов</label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={preserveProgress}
                                   onChange={(e) => setPreserveProgress(e.target.checked)} />
                            Сохранять прогресс по совпадающим урокам
                        </label>
                    </div>
                )}
            </div>

            <textarea rows={10} className="input resize-none font-mono text-xs"
                      placeholder='[{"slug":"osnovy-fotografii","title":"...","lessons":[{"title":"...","test":{"questions":[...]}}]}]'
                      value={json}
                      onChange={(e) => { setJson(e.target.value); setValidation(null); setError(''); }} />

            {validation && (
                <div className={`rounded-xl p-3 text-sm ${
                    validation.valid ? 'bg-lime/10 border border-lime/30 text-lime' : 'bg-pink/10 border border-pink/30 text-pink'
                }`}>
                    {validation.valid ? (
                        <div>
                            <div className="font-bold mb-1">✓ Структура корректна</div>
                            <div className="text-white/70 text-xs">
                                Курсов: {validation.stats.courses} · уроков: {validation.stats.lessons} ·
                                тестов: {validation.stats.tests} · вопросов: {validation.stats.questions}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="font-bold mb-1">✕ Ошибок: {validation.totalErrors || validation.errors.length}</div>
                            <ul className="text-xs text-white/70 space-y-0.5 max-h-40 overflow-y-auto">
                                {validation.errors.map((err, i) => <li key={i}>• {err}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}

            <div className="flex gap-2 flex-wrap">
                <button onClick={validate} disabled={!json.trim()} className="btn-ghost">🔍 Проверить</button>
                <button onClick={submit} disabled={busy || !json.trim()}
                        className={`${mode === 'replace' ? 'btn-primary bg-pink' : 'btn-primary'}`}>
                    {busy ? 'Импорт…' : mode === 'replace' ? '♻️ Импортировать (замена)' : '⬆ Импортировать'}
                </button>
            </div>
        </div>
    );
}

/* ──────────────────────────── Wiki админ ──────────────────────────── */

function WikiAdminTab({ token }) {
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [editingCat, setEditingCat] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const reload = async () => {
        try {
            const [c, a] = await Promise.all([
                api('/admin/wiki/categories', { token }),
                api(`/admin/wiki/articles${activeCategory ? `?category=${activeCategory}` : ''}`, { token }),
            ]);
            setCategories(c);
            setArticles(a);
        } catch (e) {
            setError(e.message);
        }
    };

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [token, activeCategory]);

    const seedDefaults = async () => {
        if (!confirm('Загрузить стартовые категории и статьи?\n\nЭто сработает только если Wiki пуста.')) return;
        setBusy(true); setError('');
        try {
            const r = await api('/admin/wiki/seed-defaults', { method: 'POST', token });
            alert(`Загружено: категорий ${r.categoriesCreated}, статей ${r.articlesCreated}`);
            await reload();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const removeCategory = async (id) => {
        if (!confirm('Удалить категорию? Статьи не удалятся, но потеряют категорию.')) return;
        try {
            await api(`/admin/wiki/categories/${id}`, { method: 'DELETE', token });
            await reload();
        } catch (e) { alert(e.message); }
    };

    const removeArticle = async (id) => {
        if (!confirm('Удалить статью?')) return;
        try {
            await api(`/admin/wiki/articles/${id}`, { method: 'DELETE', token });
            await reload();
        } catch (e) { alert(e.message); }
    };

    const filteredArticles = articles.filter((a) =>
        !search || a.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">📖 База знаний «ВикиМедиа»</div>
                        <div className="text-sm text-white/50 mt-1">
                            Категории и статьи, редактируются для раздела «ВикиМедиа» у студентов.
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={seedDefaults} disabled={busy} className="btn-ghost">
                            {busy ? '⏳…' : '🌱 Загрузить стартовые'}
                        </button>
                        <button onClick={() => setEditingCat({ mode: 'create' })} className="btn-ghost">
                            ＋ Категория
                        </button>
                        <button onClick={() => setEditing({ mode: 'create' })} className="btn-primary">
                            ＋ Статья
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="text-sm text-pink bg-pink/10 rounded-xl p-3 mb-3">{error}</div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setActiveCategory('')}
                        className={`chip ${!activeCategory ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                    >
                        Все статьи
                    </button>
                    {categories.map((c) => (
                        <div key={c.id} className="flex items-center gap-1">
                            <button
                                onClick={() => setActiveCategory(c.slug)}
                                className={`chip ${
                                    activeCategory === c.slug
                                        ? 'bg-violet text-white'
                                        : 'bg-white/5 text-white/60'
                                }`}
                            >
                                {c.icon} {c.title} ({c.articlesCount})
                            </button>
                            <button
                                onClick={() => setEditingCat({ mode: 'edit', data: c })}
                                className="text-xs text-white/40 hover:text-white px-1"
                                title="Редактировать категорию"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => removeCategory(c.id)}
                                className="text-xs text-white/40 hover:text-pink px-1"
                                title="Удалить категорию"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                <input
                    className="input"
                    placeholder="Поиск по статьям…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="card divide-y divide-white/5">
                {filteredArticles.length === 0 && (
                    <div className="p-6 text-center text-white/40">
                        Статей нет. Нажмите «Загрузить стартовые» или создайте вручную.
                    </div>
                )}
                {filteredArticles.map((a) => (
                    <div key={a.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="text-2xl">
                            {a.category?.icon || '📄'}
                        </div>
                        <div className="flex-1 min-w-[220px]">
                            <div className="font-bold">{a.title}</div>
                            <div className="text-xs text-white/40">
                                /{a.slug}
                                {a.category && ` · ${a.category.title}`}
                                {' · '}
                                <span className={a.published ? 'text-lime' : 'text-orange-300'}>
                                    {a.published ? 'опубликована' : 'черновик'}
                                </span>
                                {' · '}
                                👁 {a.views}
                            </div>
                        </div>
                        <button
                            onClick={() => setEditing({ mode: 'edit', data: a })}
                            className="chip bg-violet/30 hover:bg-violet/50"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={() => removeArticle(a.id)}
                            className="chip bg-white/5 hover:bg-pink/30"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
            </div>

            {editing && (
                <WikiArticleEditor
                    token={token}
                    initial={editing.data}
                    isNew={editing.mode === 'create'}
                    categories={categories}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await reload(); }}
                />
            )}

            {editingCat && (
                <WikiCategoryEditor
                    token={token}
                    initial={editingCat.data}
                    isNew={editingCat.mode === 'create'}
                    onClose={() => setEditingCat(null)}
                    onSaved={async () => { setEditingCat(null); await reload(); }}
                />
            )}
        </div>
    );
}

function WikiCategoryEditor({ token, initial, isNew, onClose, onSaved }) {
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
                    <h2 className="text-xl font-bold">
                        {isNew ? 'Новая категория' : 'Редактирование категории'}
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>

                <label className="text-xs text-white/40 uppercase block mb-1">Название</label>
                <input className="input mb-3" value={form.title} onChange={set('title')} />

                <label className="text-xs text-white/40 uppercase block mb-1">Slug (необязательно)</label>
                <input className="input mb-3 font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="auto" />

                <div className="grid grid-cols-[80px_1fr] gap-2 mb-3">
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Иконка</label>
                        <input className="input text-center text-lg" value={form.icon} onChange={set('icon')} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Порядок</label>
                        <input type="number" className="input" value={form.order} onChange={set('order')} />
                    </div>
                </div>

                <label className="text-xs text-white/40 uppercase block mb-1">Описание</label>
                <textarea rows={2} className="input resize-none mb-3" value={form.description} onChange={set('description')} />

                {error && <p className="text-pink text-sm mb-3">{error}</p>}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={save} disabled={busy || !form.title} className="btn-primary">
                        {busy ? '…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function WikiArticleEditor({ token, initial, isNew, categories, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: initial?.title || '',
        slug: initial?.slug || '',
        excerpt: initial?.excerpt || '',
        content: initial?.content || '',
        cover: initial?.cover || '',
        categoryId: initial?.categoryId || (categories[0]?.id ?? ''),
        tags: (initial?.tags || []).join(', '),
        published: initial?.published ?? true,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        if (!form.title.trim() || !form.content.trim()) {
            setError('Заполните название и текст статьи');
            return;
        }
        setBusy(true); setError('');
        try {
            const payload = {
                title: form.title,
                slug: form.slug || undefined,
                excerpt: form.excerpt,
                content: form.content,
                cover: form.cover || null,
                categoryId: form.categoryId || null,
                tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
                published: !!form.published,
            };

            if (isNew) {
                await api('/admin/wiki/articles', { method: 'POST', token, body: payload });
            } else {
                await api(`/admin/wiki/articles/${initial.id}`, { method: 'PATCH', token, body: payload });
            }
            await onSaved();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6" onClick={onClose}>
            <div className="card max-w-4xl mx-auto my-4 p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">
                        {isNew ? 'Новая статья' : `Статья: ${initial.title}`}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPreview((p) => !p)} className="btn-ghost !py-1.5 !px-3 text-xs">
                            {preview ? '✏️ Редактор' : '👁 Превью'}
                        </button>
                        <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                    </div>
                </div>

                {!preview && (
                    <>
                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                            <div className="md:col-span-2">
                                <label className="text-xs text-white/40 uppercase block mb-1">Заголовок</label>
                                <input className="input" value={form.title} onChange={set('title')} />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 uppercase block mb-1">Slug (необязательно)</label>
                                <input className="input font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="auto" />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 uppercase block mb-1">Категория</label>
                                <select className="input" value={form.categoryId} onChange={set('categoryId')}>
                                    <option value="">— без категории —</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-white/40 uppercase block mb-1">Краткое описание</label>
                                <input className="input" value={form.excerpt} onChange={set('excerpt')} />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 uppercase block mb-1">Теги (через запятую)</label>
                                <input className="input" value={form.tags} onChange={set('tags')} placeholder="основы, камера" />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 uppercase block mb-1">Обложка (URL)</label>
                                <input className="input" value={form.cover} onChange={set('cover')} />
                            </div>
                        </div>

                        <label className="text-xs text-white/40 uppercase block mb-1">
                            {'Текст (Markdown: # заголовок, **жирный**, *курсив*, `код`, - список, 1. список, > цитата)'}
                        </label>
                        <textarea
                            rows={16}
                            className="input resize-none font-mono text-sm"
                            value={form.content}
                            onChange={set('content')}
                        />

                        <label className="flex items-center gap-2 mt-3">
                            <input
                                type="checkbox"
                                checked={form.published}
                                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                            />
                            Опубликовано
                        </label>
                    </>
                )}

                {preview && (
                    <div className="card p-5 bg-ink-700/50">
                        <h1 className="text-2xl font-bold mb-3">{form.title || 'Без названия'}</h1>
                        {form.excerpt && (
                            <p className="text-white/60 mb-4">{form.excerpt}</p>
                        )}
                        <div
                            className="wiki-content"
                            dangerouslySetInnerHTML={{
                                __html: renderMarkdownSimple(form.content),
                            }}
                        />
                    </div>
                )}

                {error && <p className="text-pink text-sm mt-3">{error}</p>}

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={save} disabled={busy} className="btn-primary">
                        {busy ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function renderMarkdownSimple(text) {
    if (!text) return '';
    const esc = (s) =>
        String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const inline = (line) =>
        esc(line)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = false;
    let inOrdered = false;
    const close = () => {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inOrdered) { out.push('</ol>'); inOrdered = false; }
    };
    for (const line of lines) {
        if (!line.trim()) { close(); continue; }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) { close(); const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
        if (line.startsWith('> ')) { close(); out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`); continue; }
        if (/^[-*]\s+/.test(line)) {
            if (inOrdered) { out.push('</ol>'); inOrdered = false; }
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inOrdered) { out.push('<ol>'); inOrdered = true; }
            out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }
        close();
        out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join('\n');
}

/* ──────────────────────────── Дизайн сайта ──────────────────────────── */

function SiteDesignTab({ settings, setSettings, token, onSaved }) {
    const [sub, setSub] = useState('brand');
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const update = (patch) => {
        setSettings((s) => ({ ...s, ...patch }));
        setSaved(false);
    };

    const save = async () => {
        setBusy(true); setError('');
        try {
            await api('/admin/settings', { method: 'PUT', token, body: settings });
            setSaved(true);
            onSaved?.();
            setTimeout(() => setSaved(false), 2000);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const SUBS = [
        ['brand', '🎨 Брендинг'],
        ['landing', '🏠 Лендинг'],
        ['menu', '🧭 Меню'],
        ['footer', '📄 Футер'],
        ['certificate', '🏆 Сертификаты'],
    ];

    return (
        <div className="space-y-5">
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🎨 Дизайн сайта</div>
                        <div className="text-sm text-white/50 mt-1">
                            Меняйте брендинг, лендинг, меню и футер. Изменения применяются сразу после сохранения.
                        </div>
                    </div>
                    <button onClick={save} disabled={busy} className="btn-primary shrink-0">
                        {busy ? 'Сохранение…' : saved ? '✓ Сохранено' : '💾 Сохранить всё'}
                    </button>
                </div>

                {error && <div className="mb-3 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}

                <div className="flex gap-2 flex-wrap mb-4">
                    {SUBS.map(([v, l]) => (
                        <button key={v} onClick={() => setSub(v)}
                                className={`chip ${sub === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                    ))}
                </div>

                {sub === 'brand' && <BrandEditor settings={settings} update={update} />}
                {sub === 'landing' && <LandingEditor settings={settings} update={update} />}
                {sub === 'menu' && <MenuEditor settings={settings} update={update} />}
                {sub === 'footer' && <FooterEditor settings={settings} update={update} />}
                {sub === 'certificate' && <CertificateEditor settings={settings} update={update} />}
            </div>
        </div>
    );
}

function BrandEditor({ settings, update }) {
    return (
        <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label className="text-xs text-white/40 uppercase block mb-1">Логотип (текст)</label>
                <input className="input" value={settings.brand_logo_text || ''}
                       onChange={(e) => update({ brand_logo_text: e.target.value })} />
            </div>
            <div className="md:col-span-2">
                <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок логотипа</label>
                <input className="input" value={settings.brand_logo_subtitle || ''}
                       onChange={(e) => update({ brand_logo_subtitle: e.target.value })} />
            </div>

            <div className="md:col-span-2">
                <div className="text-xs text-white/40 uppercase mb-1">Акцентные цвета</div>
                <div className="grid grid-cols-3 gap-2">
                    {['brand_accent_1', 'brand_accent_2', 'brand_accent_3'].map((k, i) => (
                        <div key={k}>
                            <label className="text-[10px] text-white/40 uppercase block mb-1">Цвет {i + 1}</label>
                            <div className="flex gap-1 items-center">
                                <input type="color" value={settings[k] || '#7C3AED'}
                                       onChange={(e) => update({ [k]: e.target.value })}
                                       className="w-10 h-10 rounded-lg bg-transparent border border-white/10 shrink-0" />
                                <input className="input flex-1 text-xs" value={settings[k] || ''}
                                       onChange={(e) => update({ [k]: e.target.value })} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2">
                <div className="text-xs text-white/40 uppercase mb-1">Превью градиента</div>
                <div className="h-20 rounded-2xl"
                     style={{
                         backgroundImage: `linear-gradient(135deg, ${settings.brand_accent_1 || '#7C3AED'} 0%, ${settings.brand_accent_2 || '#EC4899'} 50%, ${settings.brand_accent_3 || '#06B6D4'} 100%)`,
                     }}
                />
            </div>
        </div>
    );
}

function LandingEditor({ settings, update }) {
    const features = (() => {
        try { return JSON.parse(settings.landing_features || '[]'); } catch { return []; }
    })();

    const updateFeature = (idx, patch) => {
        const next = features.map((f, i) => (i === idx ? { ...f, ...patch } : f));
        update({ landing_features: JSON.stringify(next) });
    };
    const addFeature = () => {
        update({ landing_features: JSON.stringify([...features, { icon: '✨', title: 'Новая фича', text: 'Описание' }]) });
    };
    const removeFeature = (idx) => {
        update({ landing_features: JSON.stringify(features.filter((_, i) => i !== idx)) });
    };

    return (
        <div className="space-y-4">
            <div className="text-xs text-white/40 uppercase tracking-wider">Hero-секция</div>

            <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Бейдж над заголовком</label>
                    <input className="input" value={settings.landing_hero_badge || ''}
                           onChange={(e) => update({ landing_hero_badge: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (начало)</label>
                    <input className="input" value={settings.landing_hero_title_prefix || ''}
                           onChange={(e) => update({ landing_hero_title_prefix: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (акцент, градиент)</label>
                    <input className="input" value={settings.landing_hero_title_accent || ''}
                           onChange={(e) => update({ landing_hero_title_accent: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (окончание)</label>
                    <input className="input" value={settings.landing_hero_title_suffix || ''}
                           onChange={(e) => update({ landing_hero_title_suffix: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок</label>
                    <textarea rows={2} className="input resize-none" value={settings.landing_hero_subtitle || ''}
                              onChange={(e) => update({ landing_hero_subtitle: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка 1</label>
                    <input className="input" value={settings.landing_hero_cta_primary || ''}
                           onChange={(e) => update({ landing_hero_cta_primary: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка 2</label>
                    <input className="input" value={settings.landing_hero_cta_secondary || ''}
                           onChange={(e) => update({ landing_hero_cta_secondary: e.target.value })} />
                </div>
            </div>

            <div className="text-xs text-white/40 uppercase tracking-wider pt-3">Секция фич</div>
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Заголовок секции</label>
                <input className="input" value={settings.landing_features_title || ''}
                       onChange={(e) => update({ landing_features_title: e.target.value })} />
            </div>

            <div className="space-y-2">
                {features.map((f, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[60px_1fr_1fr_auto] gap-2 items-start">
                        <input className="input !py-2 text-center text-lg" value={f.icon || ''}
                               onChange={(e) => updateFeature(i, { icon: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Название" value={f.title || ''}
                               onChange={(e) => updateFeature(i, { title: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Текст" value={f.text || ''}
                               onChange={(e) => updateFeature(i, { text: e.target.value })} />
                        <button onClick={() => removeFeature(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
                <button onClick={addFeature} className="chip bg-white/5 hover:bg-white/10">＋ Добавить фичу</button>
            </div>

            <div className="text-xs text-white/40 uppercase tracking-wider pt-3">CTA-секция</div>
            <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок CTA</label>
                    <input className="input" value={settings.landing_cta_title || ''}
                           onChange={(e) => update({ landing_cta_title: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок CTA</label>
                    <input className="input" value={settings.landing_cta_subtitle || ''}
                           onChange={(e) => update({ landing_cta_subtitle: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка CTA</label>
                    <input className="input" value={settings.landing_cta_button || ''}
                           onChange={(e) => update({ landing_cta_button: e.target.value })} />
                </div>
            </div>
        </div>
    );
}

function MenuEditor({ settings, update }) {
    const items = (() => {
        try { return JSON.parse(settings.nav_items || '[]'); } catch { return []; }
    })();

    const updateItem = (idx, patch) => {
        const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
        update({ nav_items: JSON.stringify(next) });
    };
    const addItem = () => {
        update({
            nav_items: JSON.stringify([
                ...items,
                { to: '/app/new', label: 'Новый раздел', icon: '✨' },
            ]),
        });
    };
    const removeItem = (idx) => {
        update({ nav_items: JSON.stringify(items.filter((_, i) => i !== idx)) });
    };
    const moveItem = (idx, dir) => {
        const arr = [...items];
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        update({ nav_items: JSON.stringify(arr) });
    };

    return (
        <div className="space-y-3">
            <div className="text-xs text-white/50">
                Пункты меню в сайдбаре (ПК) и нижней навигации (мобильный). Используйте эмодзи в поле «Иконка».
            </div>

            <div className="space-y-2">
                {items.map((it, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[60px_1fr_1fr_auto_auto_auto] gap-2 items-center">
                        <input className="input !py-2 text-center text-lg" value={it.icon || ''}
                               onChange={(e) => updateItem(i, { icon: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Название" value={it.label || ''}
                               onChange={(e) => updateItem(i, { label: e.target.value })} />
                        <input className="input !py-2 text-sm font-mono" placeholder="/app/..." value={it.to || ''}
                               onChange={(e) => updateItem(i, { to: e.target.value })} />
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                                className="btn-ghost !p-1.5 text-xs disabled:opacity-30">↑</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                                className="btn-ghost !p-1.5 text-xs disabled:opacity-30">↓</button>
                        <button onClick={() => removeItem(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
            </div>
            <button onClick={addItem} className="chip bg-white/5 hover:bg-white/10">＋ Добавить пункт</button>

            <div className="text-xs text-white/40 mt-3">
                Доступные маршруты: <code>/app</code>, <code>/app/chats</code>,{' '}
                <code>/app/courses</code>, <code>/app/wiki</code>.
            </div>
        </div>
    );
}

function FooterEditor({ settings, update }) {
    const links = (() => {
        try { return JSON.parse(settings.footer_links || '[]'); } catch { return []; }
    })();

    const updateLink = (idx, patch) => {
        const next = links.map((l, i) => (i === idx ? { ...l, ...patch } : l));
        update({ footer_links: JSON.stringify(next) });
    };
    const addLink = () => {
        update({ footer_links: JSON.stringify([...links, { label: 'Ссылка', url: 'https://' }]) });
    };
    const removeLink = (idx) => {
        update({ footer_links: JSON.stringify(links.filter((_, i) => i !== idx)) });
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Описание</label>
                <input className="input" value={settings.footer_description || ''}
                       onChange={(e) => update({ footer_description: e.target.value })} />
            </div>
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Копирайт</label>
                <input className="input" value={settings.footer_copyright || ''}
                       onChange={(e) => update({ footer_copyright: e.target.value })} />
            </div>

            <div className="text-xs text-white/40 uppercase tracking-wider pt-2">Ссылки</div>
            <div className="space-y-2">
                {links.map((l, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                        <input className="input !py-2 text-sm" placeholder="Название" value={l.label || ''}
                               onChange={(e) => updateLink(i, { label: e.target.value })} />
                        <input className="input !py-2 text-sm font-mono" placeholder="https://" value={l.url || ''}
                               onChange={(e) => updateLink(i, { url: e.target.value })} />
                        <button onClick={() => removeLink(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
            </div>
            <button onClick={addLink} className="chip bg-white/5 hover:bg-white/10">＋ Добавить ссылку</button>
        </div>
    );
}

function CertificateEditor({ settings, update }) {
    const previewTemplate = settings.certificate_template || 'gradient';
    const accent1 = settings.certificate_accent_1 || '#7C3AED';
    const accent2 = settings.certificate_accent_2 || '#EC4899';

    const previewBg = (() => {
        switch (previewTemplate) {
            case 'classic': return '#fdfaf3';
            case 'dark': return '#0b0b14';
            case 'minimal': return '#ffffff';
            default: return `linear-gradient(135deg, ${accent1} 0%, ${accent2} 100%)`;
        }
    })();
    const previewText =
        previewTemplate === 'classic' || previewTemplate === 'minimal' ? '#1a1a1a' : '#ffffff';

    return (
        <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Шаблон</label>
                    <select className="input" value={settings.certificate_template || 'gradient'}
                            onChange={(e) => update({ certificate_template: e.target.value })}>
                        {TEMPLATES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Акцент 1</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" value={accent1}
                                   onChange={(e) => update({ certificate_accent_1: e.target.value })}
                                   className="w-12 h-10 rounded-lg bg-transparent border border-white/10" />
                            <input className="input flex-1" value={accent1}
                                   onChange={(e) => update({ certificate_accent_1: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Акцент 2</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" value={accent2}
                                   onChange={(e) => update({ certificate_accent_2: e.target.value })}
                                   className="w-12 h-10 rounded-lg bg-transparent border border-white/10" />
                            <input className="input flex-1" value={accent2}
                                   onChange={(e) => update({ certificate_accent_2: e.target.value })} />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Название организации</label>
                    <input className="input" value={settings.certificate_org_name || ''}
                           onChange={(e) => update({ certificate_org_name: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок</label>
                    <input className="input" value={settings.certificate_subtitle || ''}
                           onChange={(e) => update({ certificate_subtitle: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Подпись</label>
                    <input className="input" value={settings.certificate_signature || ''}
                           onChange={(e) => update({ certificate_signature: e.target.value })} />
                </div>
            </div>
            <div>
                <div className="text-xs text-white/40 uppercase mb-2">Превью</div>
                <div className="rounded-2xl p-6 relative overflow-hidden min-h-[280px] flex flex-col justify-between"
                     style={{ background: previewBg, color: previewText }}>
                    <div>
                        <div className="text-xs uppercase tracking-widest opacity-70">
                            {settings.certificate_org_name || 'MEDIA·RAF·RAW'}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider opacity-50 mt-0.5">
                            {settings.certificate_subtitle || 'Студенческий медиацентр'}
                        </div>
                    </div>
                    <div className="text-center my-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">Сертификат</div>
                        <div className="text-xs opacity-80 mb-3">подтверждает, что</div>
                        <div className="text-xl font-extrabold">Иван Иванов</div>
                        <div className="text-xs opacity-80 mt-2">успешно прошёл(ла) курс</div>
                        <div className="text-sm font-bold mt-1">«Название курса»</div>
                    </div>
                    <div className="flex justify-between items-end text-[10px]">
                        <div>
                            <div className="uppercase tracking-widest opacity-60">Дата</div>
                            <div className="font-semibold">{new Date().toLocaleDateString('ru-RU')}</div>
                        </div>
                        <div className="text-2xl">🏆</div>
                        <div className="text-right">
                            <div className="uppercase tracking-widest opacity-60">Серийный №</div>
                            <div className="font-mono font-semibold">MRR-2025-ABC123</div>
                            {settings.certificate_signature && (
                                <div className="opacity-60 mt-1">{settings.certificate_signature}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── Бэкапы ──────────────────────────── */

function BackupsTab({ token }) {
    const [list, setList] = useState([]);
    const [info, setInfo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'ok' | 'err', text }
    const [downloading, setDownloading] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(false);

    const loadList = () =>
        api('/admin/backups', { token }).then(setList).catch(() => {});

    const loadInfo = async () => {
        setLoadingInfo(true);
        try {
            const r = await api('/admin/maintenance/dbinfo', { token });
            setInfo(r);
        } catch {
            setInfo(null);
        } finally {
            setLoadingInfo(false);
        }
    };

    useEffect(() => {
        loadList();
        loadInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const create = async (format) => {
        setShowCreate(false);
        setBusy(true);
        setMessage(null);
        try {
            const b = await api('/admin/backups', {
                method: 'POST',
                token,
                body: { format },
            });
            setMessage({ type: 'ok', text: `Создан бэкап: ${b.filename}` });
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        if (!restoreTarget) return;
        setBusy(true);
        setMessage(null);
        try {
            const r = await api('/admin/backups/restore', {
                method: 'POST',
                token,
                body: { filename: restoreTarget },
            });
            setMessage({
                type: 'ok',
                text: `Восстановлено из ${restoreTarget}. Страховочная копия: ${r.safetyBackup}. Перезапустите сервер.`,
            });
            setRestoreTarget(null);
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (filename) => {
        if (!confirm(`Удалить ${filename}?`)) return;
        try {
            await api(`/admin/backups/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                token,
            });
            await loadList();
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        }
    };

    const download = async (filename) => {
        setDownloading(filename);
        setMessage(null);
        try {
            const base = import.meta.env.VITE_API || 'http://localhost:4000/api';
            const res = await fetch(
                `${base}/admin/backups/${encodeURIComponent(filename)}/download`,
                { method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
            );
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage({ type: 'ok', text: `Скачано: ${filename}` });
        } catch (e) {
            setMessage({ type: 'err', text: e.message || 'Не удалось скачать' });
        } finally {
            setDownloading(null);
        }
    };

    const vacuum = async () => {
        if (!confirm('Выполнить VACUUM ANALYZE?\n\nОперация обновит статистику планировщика и освободит место от мёртвых строк. Не блокирует работу.')) return;
        setBusy(true);
        setMessage(null);
        try {
            await api('/admin/maintenance/vacuum', { method: 'POST', token });
            setMessage({ type: 'ok', text: 'VACUUM ANALYZE выполнен' });
            await loadInfo();
        } catch (e) {
            setMessage({ type: 'err', text: e.message });
        } finally {
            setBusy(false);
        }
    };

    const fmtSize = (n) => {
        if (!n && n !== 0) return '—';
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
        return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
    };

    const tools = info?.tools;

    return (
        <div className="space-y-4">
            {/* ─── Информация о БД ─── */}
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div className="min-w-0">
                        <div className="font-bold text-lg">🐘 PostgreSQL</div>
                        <div className="text-sm text-white/50 mt-1">
                            {loadingInfo && !info
                                ? 'Загрузка…'
                                : info
                                    ? `${info.version.split(' ').slice(0, 2).join(' ')}`
                                    : 'Не удалось получить информацию'}
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={loadInfo} disabled={loadingInfo} className="btn-ghost !py-2 text-sm">
                            🔄 Обновить
                        </button>
                        <button onClick={vacuum} disabled={busy} className="btn-ghost !py-2 text-sm">
                            🧹 VACUUM
                        </button>
                    </div>
                </div>

                {info && (
                    <>
                        <div className="grid sm:grid-cols-3 gap-3 mb-4">
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Размер БД</div>
                                <div className="text-xl font-bold mt-1">{info.sizePretty}</div>
                                <div className="text-[10px] text-white/30">{info.sizeBytes.toLocaleString('ru-RU')} байт</div>
                            </div>
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Подключение</div>
                                <div className="font-mono text-sm mt-1 truncate">
                                    {info.user}@{info.host}:{info.port}
                                </div>
                                <div className="text-[10px] text-white/30 truncate">{info.database}</div>
                            </div>
                            <div className="card p-3 bg-ink-700/50">
                                <div className="text-xs text-white/40 uppercase tracking-wider">Утилиты</div>
                                <div className="text-xs mt-1 space-y-0.5">
                                    <div className={tools?.pgDumpOk ? 'text-lime' : 'text-pink'}>
                                        {tools?.pgDumpOk ? '✓' : '✗'} pg_dump
                                    </div>
                                    <div className={tools?.pgRestoreOk ? 'text-lime' : 'text-pink'}>
                                        {tools?.pgRestoreOk ? '✓' : '✗'} pg_restore
                                    </div>
                                </div>
                            </div>
                        </div>

                        {info.tables?.length > 0 && (
                            <details>
                                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 select-none">
                                    Таблицы: {info.tables.length} (нажмите для подробностей)
                                </summary>
                                <div className="mt-2 max-h-[280px] overflow-y-auto pr-1">
                                    <div className="text-[11px] text-white/40 grid grid-cols-[1fr_60px_80px_80px] gap-2 px-2 py-1 uppercase tracking-wider">
                                        <span>Таблица</span>
                                        <span className="text-right">Строк</span>
                                        <span className="text-right">Heap</span>
                                        <span className="text-right">Всего</span>
                                    </div>
                                    {info.tables.map((t) => (
                                        <div
                                            key={t.name}
                                            className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-white/5"
                                        >
                                            <span className="font-mono truncate">{t.name}</span>
                                            <span className="text-right tabular-nums">
                                                {t.liveRows.toLocaleString('ru-RU')}
                                                {t.deadRows > 0 && (
                                                    <span className="text-white/30 ml-1">+{t.deadRows}</span>
                                                )}
                                            </span>
                                            <span className="text-right tabular-nums text-white/50">{fmtSize(t.heapBytes)}</span>
                                            <span className="text-right tabular-nums">{fmtSize(t.totalBytes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </>
                )}

                {tools && (!tools.pgDumpOk || !tools.pgRestoreOk) && (
                    <div className="mt-3 text-xs text-pink bg-pink/10 rounded-xl p-3">
                        <div className="font-bold mb-1">⚠ Утилиты PostgreSQL не найдены</div>
                        <div className="text-white/60">
                            Установите клиентские утилиты ({tools.pgDumpPath}), либо укажите путь через
                            переменные окружения <code className="font-mono">MRR_PG_DUMP_PATH</code> и{' '}
                            <code className="font-mono">MRR_PG_RESTORE_PATH</code>.
                            Без них создание и восстановление бэкапов недоступны.
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Бэкапы ─── */}
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🗄️ Резервные копии</div>
                        <div className="text-sm text-white/50 mt-1">
                            Custom-формат (.dump) — для восстановления. Plain (.sql) — для просмотра и ручного залива.
                        </div>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowCreate((v) => !v)}
                            disabled={busy || (tools && !tools.pgDumpOk)}
                            className="btn-primary"
                        >
                            {busy ? '…' : '＋ Создать бэкап'}
                        </button>
                        {showCreate && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowCreate(false)} />
                                <div className="absolute right-0 top-full mt-1 z-20 card p-1 w-56">
                                    <button
                                        onClick={() => create('custom')}
                                        className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5"
                                    >
                                        <div className="font-semibold">🗜️ Custom (.dump)</div>
                                        <div className="text-xs text-white/40">Сжатый, для восстановления</div>
                                    </button>
                                    <button
                                        onClick={() => create('plain')}
                                        className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5"
                                    >
                                        <div className="font-semibold">📄 Plain (.sql)</div>
                                        <div className="text-xs text-white/40">Текстовый, для просмотра</div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {message && (
                    <div
                        className={`mb-3 text-sm rounded-xl p-3 ${
                            message.type === 'ok'
                                ? 'text-lime bg-lime/10 border border-lime/30'
                                : 'text-pink bg-pink/10 border border-pink/30'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="divide-y divide-white/5 -mx-2">
                    {list.length === 0 && (
                        <div className="p-6 text-center text-white/40">Бэкапов пока нет</div>
                    )}
                    {list.map((b) => (
                        <div key={b.filename} className="px-2 py-3 flex items-center gap-3 flex-wrap">
                            <div className="text-2xl shrink-0">
                                {b.isSafety ? '🛟' : b.isAuto ? '⏰' : b.format === 'plain' ? '📄' : '🗜️'}
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <div className="font-mono text-sm truncate">{b.filename}</div>
                                <div className="text-xs text-white/40">
                                    {new Date(b.createdAt).toLocaleString('ru-RU')} · {fmtSize(b.size)}
                                    {b.format === 'plain' && ' · текстовый, без восстановления'}
                                </div>
                            </div>
                            <button
                                onClick={() => download(b.filename)}
                                disabled={downloading === b.filename}
                                className="chip bg-white/5 hover:bg-white/10"
                                title="Скачать"
                            >
                                {downloading === b.filename ? '⏳' : '⬇'}
                            </button>
                            <button
                                onClick={() => setRestoreTarget(b.filename)}
                                disabled={busy || !b.restorable}
                                className={`chip ${
                                    b.restorable
                                        ? 'bg-violet/30 hover:bg-violet/50'
                                        : 'bg-white/5 opacity-40 cursor-not-allowed'
                                }`}
                                title={b.restorable ? 'Восстановить из этого бэкапа' : 'Только .dump можно восстановить'}
                            >
                                ↺ Восстановить
                            </button>
                            <button
                                onClick={() => remove(b.filename)}
                                disabled={busy}
                                className="chip bg-white/5 hover:bg-pink/30"
                                title="Удалить"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Модалка подтверждения восстановления ─── */}
            {restoreTarget && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => !busy && setRestoreTarget(null)}
                >
                    <div
                        className="card max-w-lg w-full p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-2xl mb-2">⚠️</div>
                        <h3 className="text-xl font-bold mb-3">Восстановить базу?</h3>
                        <p className="text-sm text-white/70 mb-4">
                            Текущее содержимое БД будет заменено данными из{' '}
                            <span className="font-mono text-white">{restoreTarget}</span>.
                            Перед восстановлением автоматически создаётся страховочная копия{' '}
                            <span className="font-mono">pre-restore_*</span>.
                        </p>
                        <p className="text-sm text-orange-300 mb-4">
                            После восстановления требуется перезапуск backend.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setRestoreTarget(null)}
                                disabled={busy}
                                className="btn-ghost"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={restore}
                                disabled={busy}
                                className="btn-primary"
                            >
                                {busy ? 'Восстановление…' : '↺ Восстановить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── Системные настройки ──────────────────────────── */

function SettingsTab({ settings, setSettings, token }) {
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);

    const update = (patch) => {
        setSettings((s) => ({ ...s, ...patch }));
        setSaved(false);
    };

    const save = async () => {
        setBusy(true);
        try {
            await api('/admin/settings', { method: 'PUT', token, body: settings });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">⚙️ Системные настройки</div>
                        <div className="text-sm text-white/50 mt-1">
                            Название, описание, контакты, стрим и соцсети.
                        </div>
                    </div>
                    <button onClick={save} disabled={busy} className="btn-primary">
                        {busy ? 'Сохранение…' : saved ? '✓ Сохранено' : '💾 Сохранить'}
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">Название сайта</label>
                        <input className="input mt-1" value={settings.site_name || ''}
                               onChange={(e) => update({ site_name: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">Описание</label>
                        <input className="input mt-1" value={settings.site_description || ''}
                               onChange={(e) => update({ site_description: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">Email</label>
                        <input className="input mt-1" value={settings.contact_email || ''}
                               onChange={(e) => update({ contact_email: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">Стрим Radio Политех-FM</label>
                        <input className="input mt-1" value={settings.radio_stream_url || ''}
                               onChange={(e) => update({ radio_stream_url: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">VK</label>
                        <input className="input mt-1" value={settings.vk_link || ''}
                               onChange={(e) => update({ vk_link: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider">Telegram</label>
                        <input className="input mt-1" value={settings.tg_link || ''}
                               onChange={(e) => update({ tg_link: e.target.value })} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────── Push-админ ─────────── */

function PushAdminTab({ token, users, courses }) {
    const [stats, setStats] = useState({});
    const [subs, setSubs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [courseId, setCourseId] = useState('');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/app');

    const reload = async () => {
        try {
            const [s, list, g] = await Promise.all([
                api('/admin/push/stats', { token }),
                api('/admin/push/subscriptions', { token }),
                api('/admin/groups', { token }).catch(() => []),
            ]);
            setStats(s);
            setSubs(list);
            setGroups(g);
        } catch (e) {
            setError(e.message);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const send = async () => {
        if (!title.trim() || !body.trim()) {
            setError('Заполните заголовок и текст');
            return;
        }
        if (!confirm('Отправить push выбранным получателям?')) return;

        setBusy(true);
        setError('');
        setResult(null);
        try {
            const payload = { target, title, body, url };
            if (target === 'direction') payload.direction = direction;
            if (target === 'course') payload.courseId = courseId;
            if (target === 'group') payload.group = group;
            const r = await api('/admin/push/send', { method: 'POST', token, body: payload });
            setResult(r);
            setTitle('');
            setBody('');
            await reload();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const testSelf = async () => {
        setBusy(true);
        setError('');
        try {
            const r = await api('/admin/push/test-self', {
                method: 'POST',
                token,
                body: { title: 'Тест из админки', body: 'Push-сервис работает ✅' },
            });
            alert(`Отправлено: ${r.sent || 0}, ошибок: ${r.failed || 0}`);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">🔔 Push-уведомления</div>
                        <div className="text-sm text-white/50 mt-1">
                            Отправляются даже когда приложение закрыто. Требуется HTTPS и разрешение пользователя.
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={testSelf} disabled={busy} className="btn-ghost">
                            🧪 Тест себе
                        </button>
                        <button onClick={reload} disabled={busy} className="btn-ghost">
                            🔄 Обновить
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.totalSubscriptions ?? '—'}</div>
                        <div className="text-xs text-white/50">Всего подписок</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.uniqueUsers ?? '—'}</div>
                        <div className="text-xs text-white/50">Уникальных пользователей</div>
                    </div>
                    <div className="card p-4">
                        <div className="text-2xl font-bold">{stats.activeLast7Days ?? '—'}</div>
                        <div className="text-xs text-white/50">Активных за 7 дней</div>
                    </div>
                </div>
            </div>

            <div className="card p-5 space-y-3">
                <div className="font-bold">📣 Массовая рассылка</div>

                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['all', '👥 Всем'],
                            ['direction', '🎯 По направлению'],
                            ['course', '📚 По курсу'],
                            ['group', '🎓 По группе'],
                        ].map(([v, l]) => (
                            <button
                                key={v}
                                onClick={() => setTarget(v)}
                                className={`chip ${target === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {target === 'direction' && (
                    <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                        <option value="photo">📸 Фото</option>
                        <option value="video">🎥 Видео</option>
                        <option value="radio">📻 Радио</option>
                        <option value="sound">🎚️ Звук</option>
                    </select>
                )}

                {target === 'course' && (
                    <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        <option value="">— выберите курс —</option>
                        {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                )}

                {target === 'group' && (
                    <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                        <option value="">— выберите группу —</option>
                        {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}

                <input
                    className="input"
                    placeholder="Заголовок"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="Текст уведомления"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                />
                <input
                    className="input"
                    placeholder="URL для перехода (например, /app/chats/xxx)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />

                <button onClick={send} disabled={busy} className="btn-primary">
                    {busy ? 'Отправка…' : '🔔 Отправить push'}
                </button>

                {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}
                {result && (
                    <div className="text-sm text-lime bg-lime/10 rounded-xl p-3">
                        ✓ Получателей: {result.recipients} · Доставлено: {result.sent} · Ошибок: {result.failed}
                        {result.gone > 0 && ` · Удалено мёртвых подписок: ${result.gone}`}
                    </div>
                )}
            </div>

            <div className="card p-5">
                <div className="font-bold mb-3">📋 Активные подписки</div>
                {subs.length === 0 && (
                    <div className="text-center text-white/40 text-sm py-4">Пока никто не подписался</div>
                )}
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                    {subs.map((s) => (
                        <div key={s.id} className="p-3 flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                                <div className="font-semibold text-sm">{s.user.fullName}</div>
                                <div className="text-xs text-white/40 truncate font-mono">{s.endpoint}</div>
                            </div>
                            <div className="text-[10px] text-white/30">
                                {new Date(s.lastUsed).toLocaleString('ru-RU')}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}