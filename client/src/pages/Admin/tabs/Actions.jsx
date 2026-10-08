import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client.js';
import { useToast } from '../../../store/toast.jsx';
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
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function shortAction(a) {
    return a.length > 40 ? a.slice(0, 37) + '…' : a;
}

export default function Actions({ token }) {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(
        100,
        Math.max(1, Number(searchParams.get('limit')) || 20)
    );
    const action = searchParams.get('action') ?? '';
    const adminId = searchParams.get('adminId') ?? '';
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const failedOnly = searchParams.get('failed') === '1';

    const updateFilters = (patch) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(patch)) {
                    if (v === '' || v === null || v === undefined || v === false) {
                        next.delete(k);
                    } else if (v === true) {
                        next.set(k, '1');
                    } else {
                        next.set(k, String(v));
                    }
                }
                if (!('page' in patch)) next.delete('page');
                return next;
            },
            { replace: true }
        );
    };

    const [data, setData] = useState(null);
    const [meta, setMeta] = useState({ actions: [], admins: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const q = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });
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
            /* не критично */
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
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const k of ['action', 'adminId', 'from', 'to', 'failed', 'page']) {
                    next.delete(k);
                }
                return next;
            },
            { replace: true }
        );
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
                                onChange={(e) =>
                                    updateFilters({ limit: Number(e.target.value) })
                                }
                            >
                                {[20, 50, 100].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="btn-ghost !py-2"
                        >
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
                            onChange={(e) => updateFilters({ action: e.target.value })}
                            list="admin-actions-list"
                        />
                        <datalist id="admin-actions-list">
                            {actionOptions.map((a) => (
                                <option key={a} value={a} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Админ
                        </label>
                        <select
                            className="input !py-1.5 !text-sm"
                            value={adminId}
                            onChange={(e) => updateFilters({ adminId: e.target.value })}
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
                            onChange={(e) => updateFilters({ from: e.target.value })}
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
                            onChange={(e) => updateFilters({ to: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={failedOnly}
                            onChange={(e) =>
                                updateFilters({ failed: e.target.checked })
                            }
                        />
                        Только с ошибками
                    </label>
                    {anyFilter && (
                        <button
                            onClick={resetFilters}
                            className="btn-ghost !py-1 text-xs ml-auto"
                        >
                            Сбросить фильтры
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="card p-4 text-pink">{error}</div>}

            {data && (
                <>
                    <div className="text-sm text-white/50 px-1">
                        Всего: {data.total} · Страница {data.page} из{' '}
                        {Math.max(1, data.pages)}
                    </div>

                    <div className="card overflow-x-auto">
                        {data.items.length === 0 ? (
                            <div className="p-8 text-center text-white/40">
                                Записей нет
                            </div>
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
                                        <Fragment key={it.id}>
                                            <tr
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
                                                            <Avatar
                                                                user={it.admin}
                                                                size={24}
                                                            />
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
                                                            <span
                                                                className={`chip text-[10px] ${FAILED_CHIP}`}
                                                            >
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
                                                            setOpenId(
                                                                isOpen ? null : it.id
                                                            )
                                                        }
                                                        className="text-white/40 hover:text-white text-xs"
                                                    >
                                                        {isOpen ? '▾' : '▸'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="p-3 bg-black/20"
                                                    >
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
                                        </Fragment>
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
                                onClick={() => updateFilters({ page: page - 1 })}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                ← Назад
                            </button>
                            <div className="self-center text-sm text-white/50">
                                {page} / {data.pages}
                            </div>
                            <button
                                disabled={page >= data.pages}
                                onClick={() => updateFilters({ page: page + 1 })}
                                className="btn-ghost !py-2 disabled:opacity-30"
                            >
                                Вперёд →
                            </button>
                        </div>
                    )}
                </>
            )}

            <ActionsCleanupBlock token={token} />
        </div>
    );
}

/* ═══════════ Автоочистка журнала ═══════════ */

function ActionsCleanupBlock({ token }) {
    const [state, setState] = useState(null);
    const [draft, setDraft] = useState({ enabled: false, days: 180 });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [confirmRun, setConfirmRun] = useState(false);

    const load = async () => {
        try {
            const r = await api('/admin/actions/cleanup-settings', { token });
            setState(r);
            setDraft({ enabled: r.enabled, days: r.days });
        } catch {
            setState(null);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (!state) return null;

    const dirty =
        draft.enabled !== state.enabled || draft.days !== state.days;

    const saveSettings = async () => {
        if (!dirty) return;
        setBusy(true);
        setMsg('');
        try {
            await api('/admin/settings', {
                method: 'PUT',
                token,
                body: {
                    actions_cleanup_enabled: draft.enabled ? 'true' : 'false',
                    actions_cleanup_days: String(draft.days),
                },
            });
            await load();
            setMsg('✓ Настройки сохранены');
            setTimeout(() => setMsg(''), 2500);
        } catch (e) {
            setMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const cancelDraft = () => {
        setDraft({ enabled: state.enabled, days: state.days });
        setMsg('');
    };

    const runDry = async () => {
        setBusy(true);
        setMsg('');
        try {
            const r = await api('/admin/actions/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: true },
            });
            setMsg(
                r.wouldDelete > 0
                    ? `🔍 Будет удалено: ${r.wouldDelete} записей (старше ${r.days} дн.)`
                    : '✓ Нечего удалять'
            );
        } catch (e) {
            setMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const runReal = async () => {
        setConfirmRun(false);
        setBusy(true);
        setMsg('');
        try {
            const r = await api('/admin/actions/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: false },
            });
            setMsg(
                r.deleted > 0
                    ? `🗑️ Удалено: ${r.deleted} записей (старше ${r.days} дн.)`
                    : '✓ Нечего удалять'
            );
            await load();
        } catch (e) {
            setMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <div className="font-bold text-lg">🧹 Автоочистка журнала</div>
                    <div className="text-sm text-white/50 mt-1">
                        Удаляет старые записи AdminAction. Минимум{' '}
                        {state.minDays} дней — защита от случайной очистки свежего.
                        Запуск раз в сутки в 06:00.
                    </div>
                </div>
                {dirty && (
                    <span className="chip bg-orange-500/20 text-orange-300 text-[10px] shrink-0">
                        ● Есть несохранённые изменения
                    </span>
                )}
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                    type="checkbox"
                    checked={draft.enabled}
                    disabled={busy}
                    onChange={(e) =>
                        setDraft((d) => ({ ...d, enabled: e.target.checked }))
                    }
                />
                <span>Включить автоочистку</span>
            </label>

            <div className="grid sm:grid-cols-[240px_1fr] gap-3 items-start">
                <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                        Хранить (дней)
                    </label>
                    <input
                        type="number"
                        min={state.minDays}
                        max={state.maxDays}
                        disabled={busy}
                        className="input"
                        value={draft.days}
                        onChange={(e) =>
                            setDraft((d) => ({
                                ...d,
                                days: Number(e.target.value) || state.minDays,
                            }))
                        }
                    />
                    <div className="text-[11px] text-white/40 mt-1">
                        От {state.minDays} до {state.maxDays}. По умолчанию — 180.
                    </div>
                </div>

                <div className="rounded-2xl bg-ink-700/50 p-3">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                        Состояние сейчас
                    </div>
                    <div className="text-sm space-y-0.5">
                        <div>
                            Всего записей:{' '}
                            <b>{state.total.toLocaleString('ru-RU')}</b>
                        </div>
                        {state.oldest && (
                            <div className="text-white/50">
                                Самая старая:{' '}
                                {new Date(state.oldest).toLocaleDateString('ru-RU')}
                            </div>
                        )}
                        {state.stale > 0 && (
                            <div className="text-orange-300">
                                Под очистку сейчас:{' '}
                                <b>{state.stale.toLocaleString('ru-RU')}</b>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
                <button
                    onClick={saveSettings}
                    disabled={busy || !dirty}
                    className="btn-primary !py-2 text-sm"
                >
                    {busy ? '⏳' : '💾 Сохранить настройки'}
                </button>
                {dirty && (
                    <button
                        onClick={cancelDraft}
                        disabled={busy}
                        className="btn-ghost !py-2 text-sm"
                    >
                        Отмена
                    </button>
                )}
                <div className="flex-1" />
                <button
                    onClick={runDry}
                    disabled={busy}
                    className="btn-ghost !py-2 text-sm"
                >
                    {busy ? '⏳' : '🔍 Проверить'}
                </button>
                <button
                    onClick={() => setConfirmRun(true)}
                    disabled={busy || state.stale === 0}
                    className="btn-primary !bg-pink !py-2 text-sm"
                >
                    🗑️ Запустить сейчас
                </button>
            </div>

            {msg && (
                <div className="mt-3 text-sm bg-white/5 rounded-xl p-3">{msg}</div>
            )}

            {confirmRun && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => !busy && setConfirmRun(false)}
                >
                    <div
                        className="card max-w-lg w-full p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-2xl mb-2">⚠️</div>
                        <h3 className="text-xl font-bold mb-3">
                            Удалить старые записи журнала?
                        </h3>
                        <p className="text-sm text-white/70 mb-4">
                            Будут удалены записи старше {state.days} дней. Сейчас
                            под критерий попадает <b>{state.stale}</b> из{' '}
                            {state.total}. Действие необратимо.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmRun(false)}
                                disabled={busy}
                                className="btn-ghost"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={runReal}
                                disabled={busy}
                                className="btn-primary !bg-pink"
                            >
                                {busy ? '…' : 'Удалить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}