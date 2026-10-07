import { useEffect, useState, useMemo } from 'react';
import { api } from '../../../api/client.js';
import Avatar from '../../../components/Avatar.jsx';

const FAILED_CHIP = 'bg-pink/20 text-pink';

function fmtDuration(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms} мс`;
    return `${(ms / 1000).toFixed(2)} с`;
}

function fmtDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function shortAction(a) {
    // Длинные action'ы обрезаем визуально, полный видно в payload/тултипе.
    return a.length > 40 ? a.slice(0, 37) + '…' : a;
}

export default function Actions({ token }) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [action, setAction] = useState('');
    const [adminId, setAdminId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [failedOnly, setFailedOnly] = useState(false);

    const [data, setData] = useState(null);
    const [meta, setMeta] = useState({ actions: [], admins: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const q = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (action) q.set('action', action);
            if (adminId) q.set('adminId', adminId);
            if (from) q.set('from', from);
            if (to) q.set('to', to);
            if (failedOnly) q.set('failed', '1');
            const r = await api(`/admin/actions?${q}`, { token });
            setData(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadMeta = async () => {
        try {
            setMeta(await api('/admin/actions/meta', { token }));
        } catch {
            /* не критично, если мета не пришла */
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, action, adminId, from, to, failedOnly]);

    useEffect(() => {
        loadMeta();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetFilters = () => {
        setAction('');
        setAdminId('');
        setFrom('');
        setTo('');
        setFailedOnly(false);
        setPage(1);
    };

    const anyFilter = action || adminId || from || to || failedOnly;

    const adminOptions = useMemo(() => meta.admins || [], [meta.admins]);
    const actionOptions = useMemo(() => meta.actions || [], [meta.actions]);

    return (
        <div className="space-y-4">
            <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-bold text-lg">📜 История действий админов</div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-white/40">
                            На странице:
                            <select
                                className="input !py-1 !w-auto ml-2 !text-sm"
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                            >
                                {[20, 50, 100].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <button onClick={load} disabled={loading} className="btn-ghost !py-2">
                            {loading ? '⏳' : '🔄'}
                        </button>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Действие
                        </label>
                        <input
                            className="input !py-1.5 !text-sm"
                            placeholder="maintenance_…"
                            value={action}
                            onChange={(e) => { setAction(e.target.value); setPage(1); }}
                            list="admin-actions-list"
                        />
                        <datalist id="admin-actions-list">
                            {actionOptions.map((a) => <option key={a} value={a} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Админ
                        </label>
                        <select
                            className="input !py-1.5 !text-sm"
                            value={adminId}
                            onChange={(e) => { setAdminId(e.target.value); setPage(1); }}
                        >
                            <option value="">Все</option>
                            {adminOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.fullName} (@{a.username})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            С
                        </label>
                        <input
                            type="datetime-local"
                            className="input !py-1.5 !text-sm"
                            value={from}
                            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            По
                        </label>
                        <input
                            type="datetime-local"
                            className="input !py-1.5 !text-sm"
                            value={to}
                            onChange={(e) => { setTo(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={failedOnly}
                            onChange={(e) => { setFailedOnly(e.target.checked); setPage(1); }}
                        />
                        Только с ошибками
                    </label>
                    {anyFilter && (
                        <button onClick={resetFilters} className="btn-ghost !py-1 text-xs ml-auto">
                            Сбросить фильтры
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="card p-4 text-pink">{error}</div>}

            {data && (
                <>
                    <div className="text-sm text-white/50 px-1">
                        Всего: {data.total} · Страница {data.page} из {Math.max(1, data.pages)}
                    </div>

                    <div className="card overflow-x-auto">
                        {data.items.length === 0 ? (
                            <div className="p-8 text-center text-white/40">Записей нет</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="text-xs text-white/40 uppercase tracking-wider">
                                <tr className="border-b border-white/10">
                                    <th className="text-left p-3 w-40">Когда</th>
                                    <th className="text-left p-3 w-48">Кто</th>
                                    <th className="text-left p-3">Действие</th>
                                    <th className="text-right p-3 w-20">Затронуто</th>
                                    <th className="text-right p-3 w-24">Время</th>
                                    <th className="text-center p-3 w-20"></th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.items.map((it) => {
                                    const isOpen = openId === it.id;
                                    const hasError = !!it.error;
                                    return (
                                        <>
                                            <tr
                                                key={it.id}
                                                className={`border-b border-white/5 hover:bg-white/5 ${
                                                    hasError ? 'bg-pink/5' : ''
                                                }`}
                                            >
                                                <td className="p-3 text-white/60 whitespace-nowrap text-xs">
                                                    {fmtDate(it.createdAt)}
                                                </td>
                                                <td className="p-3">
                                                    {it.admin ? (
                                                        <div className="flex items-center gap-2">
                                                            <Avatar user={it.admin} size={24} />
                                                            <div className="min-w-0">
                                                                <div className="text-xs truncate">
                                                                    {it.admin.fullName}
                                                                </div>
                                                                <div className="text-[10px] text-white/40 truncate">
                                                                    @{it.admin.username}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white/30 text-xs">
                                                                (удалён)
                                                            </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                            <span
                                                                className="font-mono text-xs"
                                                                title={it.action}
                                                            >
                                                                {shortAction(it.action)}
                                                            </span>
                                                        {hasError && (
                                                            <span className={`chip text-[10px] ${FAILED_CHIP}`}>
                                                                    ошибка
                                                                </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-white/60">
                                                    {it.affected || '—'}
                                                </td>
                                                <td className="p-3 text-right text-white/50 text-xs whitespace-nowrap">
                                                    {fmtDuration(it.duration)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() =>
                                                            setOpenId(isOpen ? null : it.id)
                                                        }
                                                        className="text-white/40 hover:text-white text-xs"
                                                    >
                                                        {isOpen ? '▾' : '▸'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr key={it.id + '-details'}>
                                                    <td colSpan={6} className="p-3 bg-black/20">
                                                        <div className="space-y-2 text-xs">
                                                            <div>
                                                                <div className="text-white/40 uppercase tracking-wider mb-1">
                                                                    Payload
                                                                </div>
                                                                <pre className="bg-black/40 rounded-xl p-3 overflow-x-auto font-mono text-[11px] leading-relaxed">
{JSON.stringify(it.payload, null, 2)}
                                                                    </pre>
                                                            </div>
                                                            {it.error && (
                                                                <div>
                                                                    <div className="text-white/40 uppercase tracking-wider mb-1">
                                                                        Ошибка
                                                                    </div>
                                                                    <div className="bg-pink/10 border border-pink/30 rounded-xl p-3 text-pink font-mono">
                                                                        {it.error}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {data.pages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                ← Назад
                            </button>
                            <div className="self-center text-sm text-white/50">
                                {page} / {data.pages}
                            </div>
                            <button
                                disabled={page >= data.pages}
                                onClick={() => setPage((p) => p + 1)}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                Вперёд →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}