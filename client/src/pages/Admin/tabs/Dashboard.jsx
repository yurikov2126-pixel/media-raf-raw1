import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client.js';
import { useToast } from '../../../store/toast.jsx';
import { fmtSize, fmtUptime } from '../utils.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import OrphanFilesList from '../components/OrphanFilesList.jsx';
import SparklineCard from '../components/SparklineCard.jsx';
import QuickActions from '../components/QuickActions.jsx';
import RecentActivity from '../components/RecentActivity.jsx';
import AlertsBanner from '../components/AlertsBanner.jsx';

export default function Dashboard({ stats, token, onReload }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const periodParam = Number(searchParams.get('period'));
    const period = [7, 30].includes(periodParam) ? periodParam : 7;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const r = await api(`/admin/dashboard/summary?period=${period}`, { token });
            setData(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, token]);

    const setPeriod = (p) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', 'dash');
                next.set('period', String(p));
                return next;
            },
            { replace: true }
        );
    };

    const setTab = (t) => {
        setSearchParams({ tab: t }, { replace: true });
    };

    return (
        <div className="space-y-5">
            {data?.health?.warnings?.length > 0 && (
                <AlertsBanner warnings={data.health.warnings} />
            )}

            <StatsCards stats={stats} />

            <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-bold text-lg">📊 Динамика</div>
                <div className="flex gap-2">
                    {[7, 30].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`chip ${
                                period === p
                                    ? 'bg-violet text-white'
                                    : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {p} дн.
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SparklineCard
                    title="Регистрации"
                    icon="👥"
                    data={data?.registrations || []}
                    dataKey="value"
                    color="#A78BFA"
                    loading={loading && !data}
                />
                <SparklineCard
                    title="Активность"
                    icon="⚡"
                    data={data?.activity || []}
                    dataKey="total"
                    color="#EC4899"
                    loading={loading && !data}
                />
                <SparklineCard
                    title="Сообщения"
                    icon="✉️"
                    data={data?.activity || []}
                    dataKey="messages"
                    color="#06B6D4"
                    loading={loading && !data}
                />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
                <QuickActions onTab={setTab} />
                <RecentActivity
                    items={data?.recentActions || []}
                    onOpenAll={() => setTab('actions')}
                />
            </div>

            {error && (
                <div className="card p-4 text-pink bg-pink/10">{error}</div>
            )}

            <ServerInfoBlock token={token} />
            <MaintenanceBlock token={token} onReload={onReload} />
        </div>
    );
}

function StatsCards({ stats = {} }) {
    const cards = [
        ['Пользователи', stats.users, '👥'],
        ['Живые чаты', stats.chats, '💬'],
        ['Сообщения', stats.messages, '✉️'],
        ['Курсы', stats.courses, '📚'],
        ['Записей на курсы', stats.enrollments, '🎓'],
        ['Сертификаты', stats.certificates, '🏆'],
    ];
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(([l, v, i]) => (
                <div key={l} className="card p-5">
                    <div className="text-3xl mb-2">{i}</div>
                    <div className="text-3xl font-bold">{v ?? '—'}</div>
                    <div className="text-sm text-white/50">{l}</div>
                </div>
            ))}
        </div>
    );
}

/* ─────────── Информация о сервере ─────────── */
function ServerInfoBlock({ token }) {
    const toast = useToast();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setInfo(await api('/admin/server/info', { token }));
        } catch {
            setInfo(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runCleanup = async () => {
        setBusy(true);
        try {
            const r = await api('/admin/server/cleanup', {
                method: 'POST',
                token,
                body:
                    confirm === 'logs'
                        ? { logs: true }
                        : { backups: true, backupsDays: 30 },
            });
            if (confirm === 'logs') {
                toast.success(`Очищено логов: ${r.logs?.cleared || 0}`);
            } else {
                toast.success(`Удалено бэкапов: ${r.backups?.removed || 0}`);
            }
            await load();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    if (!info) {
        return (
            <div className="card p-5">
                <div className="font-bold text-lg mb-2">🖥️ Сервер</div>
                <div className="text-white/40 text-sm">
                    {loading ? 'Загрузка…' : 'Не удалось получить данные'}
                </div>
            </div>
        );
    }

    const Metric = ({ label, value, sub, warn }) => (
        <div className="rounded-2xl bg-ink-700/50 p-3">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                {label}
            </div>
            <div className={`text-lg font-bold ${warn ? 'text-orange-300' : ''}`}>
                {value}
            </div>
            {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
        </div>
    );

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <div className="font-bold text-lg">🖥️ Сервер</div>
                    <div className="text-sm text-white/50 mt-1">
                        {info.os.hostname} · {info.os.platform} {info.os.arch} · Uptime{' '}
                        {fmtUptime(info.os.uptime)}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="btn-ghost !py-2 text-sm"
                    >
                        {loading ? '⏳' : '🔄'}
                    </button>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <Metric
                    label="CPU"
                    value={`${info.cpu.usage}%`}
                    sub={`${info.cpu.count} ядер · load ${info.os.loadAvg[0]}`}
                    warn={info.cpu.usage > 85}
                />
                <Metric
                    label="RAM"
                    value={`${info.memory.usage}%`}
                    sub={`${fmtSize(info.memory.used)} / ${fmtSize(info.memory.total)}`}
                    warn={info.memory.usage > 90}
                />
                <Metric
                    label="Диск"
                    value={`${info.disk.usage}%`}
                    sub={`${fmtSize(info.disk.used)} / ${fmtSize(info.disk.total)}`}
                    warn={info.disk.usage > 85}
                />
                <Metric
                    label="Node.js"
                    value={fmtSize(info.node.rss)}
                    sub={`heap ${fmtSize(info.node.heapUsed)} · uptime ${fmtUptime(info.node.uptime)}`}
                />
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Metric
                    label="PostgreSQL"
                    value={info.db.sizePretty}
                    sub={`${info.db.activeConnections}/${info.db.maxConnections} соединений`}
                />
                <Metric
                    label="Uploads"
                    value={fmtSize(info.uploads.bytes)}
                    sub={`${info.uploads.count} файлов`}
                />
                <Metric
                    label="Бэкапы"
                    value={fmtSize(info.backups.bytes)}
                    sub={`${info.backups.count} файлов`}
                />
                <Metric
                    label="Логи PM2"
                    value={fmtSize(info.logs.bytes)}
                    sub={`${info.logs.files.length} файлов`}
                    warn={info.logs.bytes > 200 * 1024 * 1024}
                />
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
                <button
                    onClick={() => setConfirm('logs')}
                    disabled={busy || info.logs.bytes === 0}
                    className="btn-ghost !py-2 text-sm"
                >
                    🧹 Очистить логи
                </button>
                <button
                    onClick={() => setConfirm('backups')}
                    disabled={busy || info.backups.count === 0}
                    className="btn-ghost !py-2 text-sm"
                >
                    🗑️ Удалить бэкапы старше 30 дней
                </button>
            </div>

            <ConfirmDialog
                open={!!confirm}
                title={confirm === 'logs' ? 'Очистить логи PM2?' : 'Удалить старые бэкапы?'}
                description={
                    confirm === 'logs'
                        ? 'Все log-файлы PM2 будут обрезаны до нуля. Логи процесса будут продолжать писаться.'
                        : 'Все файлы бэкапов старше 30 дней будут удалены. Файлы pre-restore_* сохраняются всегда.'
                }
                confirmLabel={confirm === 'logs' ? 'Очистить' : 'Удалить'}
                danger
                busy={busy}
                onConfirm={runCleanup}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

/* ─────────── Обслуживание БД ─────────── */
function MaintenanceBlock({ token, onReload }) {
    const [scan, setScan] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [lastCleanup, setLastCleanup] = useState(null);
    const [error, setError] = useState('');
    const [expandedKey, setExpandedKey] = useState(null);

    const runScan = async () => {
        setScanning(true);
        setError('');
        try {
            setScan(await api('/admin/maintenance/scan', { token }));
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
        if (!confirm(`Найдено ${scan.totalProblems} проблем. Очистить?`)) return;
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

    const problems = scan?.categories?.filter((c) => c.count > 0) ?? [];
    const cleanCategories = scan?.categories?.filter((c) => c.count === 0) ?? [];

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div className="flex-1 min-w-[220px]">
                    <div className="font-bold text-lg">🧹 Обслуживание базы данных</div>
                    <div className="text-sm text-white/50 mt-1">
                        Поиск и удаление неконсистентных данных.
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={runScan}
                        disabled={scanning || cleaning}
                        className="btn-ghost"
                    >
                        {scanning ? '⏳' : '🔍 Проверить'}
                    </button>
                    <button
                        onClick={runCleanup}
                        disabled={cleaning || scanning || !scan || scan.totalProblems === 0}
                        className={`${scan?.totalProblems > 0 ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        {cleaning
                            ? '⏳'
                            : scan?.totalProblems > 0
                                ? `🧹 Обслужить (${scan.totalProblems})`
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
                                    Проверено{' '}
                                    {new Date(scan.checkedAt).toLocaleString('ru-RU')}
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
                                        Категорий с проблемами: {problems.length} из{' '}
                                        {scan.categories.length}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {problems.map((c) => {
                                    const hasDetails = c.key === 'orphanFiles';
                                    const expanded = expandedKey === c.key;
                                    return (
                                        <div
                                            key={c.key}
                                            className="bg-ink-700/50 rounded-xl overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    hasDetails &&
                                                    setExpandedKey(expanded ? null : c.key)
                                                }
                                                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left ${
                                                    hasDetails
                                                        ? 'hover:bg-white/5 cursor-pointer'
                                                        : 'cursor-default'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-semibold flex items-center gap-2">
                                                        {hasDetails && (
                                                            <span className="text-white/40 text-xs">
                                                                {expanded ? '▾' : '▸'}
                                                            </span>
                                                        )}
                                                        {c.label}
                                                    </div>
                                                    {c.hint && (
                                                        <div className="text-xs text-white/40 truncate">
                                                            {c.hint}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="chip bg-pink/20 text-pink shrink-0">
                                                    {c.count}
                                                </span>
                                            </button>

                                            {hasDetails && expanded && (
                                                <div className="px-3 pb-3">
                                                    <OrphanFilesList
                                                        details={scan.details?.orphanFiles}
                                                        token={token}
                                                        onChanged={runScan}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {cleanCategories.length > 0 && (
                        <details className="mt-3">
                            <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                                Что проверялось ({scan.categories.length})
                            </summary>
                            <div className="mt-2 grid sm:grid-cols-2 gap-1 text-xs">
                                {cleanCategories.map((c) => (
                                    <div
                                        key={c.key}
                                        className="flex items-center gap-2 text-white/50"
                                    >
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
                <div className="mt-3 text-sm text-pink bg-pink/10 rounded-xl p-3">
                    {error}
                </div>
            )}

            {lastCleanup && (
                <div className="mt-3 text-sm bg-violet/10 border border-violet/30 rounded-xl p-4">
                    <div className="font-bold text-violet-soft mb-1">
                        ✓ Обслуживание выполнено
                    </div>
                    <div className="text-white/70">
                        Всего исправлено: <b>{lastCleanup.totalFixed}</b>
                    </div>
                </div>
            )}
        </div>
    );
}