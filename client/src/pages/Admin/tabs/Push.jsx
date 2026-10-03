import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';
import Avatar from '../../../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function Push({ token, users, courses }) {
    const [stats, setStats] = useState({});
    const [subs, setSubs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Форма рассылки
    const [target, setTarget] = useState('all');
    const [direction, setDirection] = useState('photo');
    const [courseId, setCourseId] = useState('');
    const [group, setGroup] = useState('');
    const [groups, setGroups] = useState([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/app');

    // Управление подписками
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deletingOne, setDeletingOne] = useState(null);

    // Автоочистка — состояние «сохранено на сервере»
    const [cleanup, setCleanup] = useState(null);
    // Автоочистка — черновик для редактирования (сохраняется по кнопке)
    const [draft, setDraft] = useState({ enabled: false, days: 90 });
    const [cleanupBusy, setCleanupBusy] = useState(false);
    const [cleanupMessage, setCleanupMessage] = useState('');
    const [confirmCleanup, setConfirmCleanup] = useState(false);

    const reload = async () => {
        try {
            const [s, list, g, c] = await Promise.all([
                api('/admin/push/stats', { token }),
                api('/admin/push/subscriptions', { token }),
                api('/admin/groups', { token }).catch(() => []),
                api('/admin/push/cleanup-settings', { token }).catch((e) => {
                    console.warn('[push] cleanup-settings недоступен:', e.message);
                    return null;
                }),
            ]);
            setStats(s);
            setSubs(list);
            setGroups(g);
            if (c) {
                setCleanup(c);
                setDraft({ enabled: c.enabled, days: c.days });
            }
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

    /* ─── Работа с подписками ─── */

    const filteredSubs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return subs;
        return subs.filter((s) => {
            const name = s.user?.fullName?.toLowerCase() || '';
            const uname = s.user?.username?.toLowerCase() || '';
            return name.includes(q) || uname.includes(q);
        });
    }, [subs, search]);

    const grouped = useMemo(() => {
        const map = new Map();
        for (const s of filteredSubs) {
            const key = s.user?.id || s.userId || 'unknown';
            if (!map.has(key)) {
                map.set(key, {
                    user: s.user || { id: key, fullName: 'Неизвестный', username: '—' },
                    subs: [],
                });
            }
            map.get(key).subs.push(s);
        }
        return [...map.values()].sort((a, b) => {
            if (b.subs.length !== a.subs.length) return b.subs.length - a.subs.length;
            return (a.user.fullName || '').localeCompare(b.user.fullName || '', 'ru');
        });
    }, [filteredSubs]);

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectUser = (userId) => {
        const userSubIds = subs
            .filter((s) => s.user?.id === userId)
            .map((s) => s.id);
        setSelected((prev) => {
            const next = new Set(prev);
            const allSelected = userSubIds.every((id) => next.has(id));
            if (allSelected) userSubIds.forEach((id) => next.delete(id));
            else userSubIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const toggleSelectAll = () => {
        const allIds = filteredSubs.map((s) => s.id);
        const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
        setSelected(allSelected ? new Set() : new Set(allIds));
    };

    const requestDeleteOne = (sub) => setConfirmDelete({ type: 'one', sub });
    const requestDeleteUser = (user, count) => setConfirmDelete({ type: 'user', user, count });
    const requestDeleteSelected = () => {
        if (selected.size === 0) return;
        setConfirmDelete({ type: 'selected', ids: [...selected] });
    };

    const doDelete = async () => {
        if (!confirmDelete) return;
        setDeletingOne(true);
        try {
            if (confirmDelete.type === 'one') {
                await api(`/admin/push/subscriptions/${confirmDelete.sub.id}`, {
                    method: 'DELETE',
                    token,
                });
                setSelected((prev) => {
                    const next = new Set(prev);
                    next.delete(confirmDelete.sub.id);
                    return next;
                });
            } else if (confirmDelete.type === 'user') {
                await api(`/admin/push/subscriptions/user/${confirmDelete.user.id}`, {
                    method: 'DELETE',
                    token,
                });
                setSelected((prev) => {
                    const next = new Set(prev);
                    for (const s of subs) {
                        if (s.user?.id === confirmDelete.user.id) next.delete(s.id);
                    }
                    return next;
                });
            } else if (confirmDelete.type === 'selected') {
                await api('/admin/push/subscriptions/delete-many', {
                    method: 'POST',
                    token,
                    body: { ids: confirmDelete.ids },
                });
                setSelected(new Set());
            }
            setConfirmDelete(null);
            await reload();
        } catch (e) {
            setError(e.message);
        } finally {
            setDeletingOne(false);
        }
    };

    /* ─── Автоочистка ─── */

    const draftDirty =
        cleanup &&
        (draft.enabled !== cleanup.enabled || draft.days !== cleanup.days);

    const saveCleanupSettings = async () => {
        if (!draftDirty) return;
        setCleanupBusy(true);
        setCleanupMessage('');
        try {
            const body = {
                push_subscriptions_cleanup_enabled: draft.enabled ? 'true' : 'false',
                push_subscriptions_cleanup_days: String(draft.days),
            };
            await api('/admin/settings', { method: 'PUT', token, body });
            const updated = await api('/admin/push/cleanup-settings', { token });
            setCleanup(updated);
            setDraft({ enabled: updated.enabled, days: updated.days });
            setCleanupMessage('✓ Настройки сохранены');
            setTimeout(() => setCleanupMessage(''), 2500);
        } catch (e) {
            setCleanupMessage('Ошибка: ' + e.message);
        } finally {
            setCleanupBusy(false);
        }
    };

    const cancelCleanupChanges = () => {
        if (!cleanup) return;
        setDraft({ enabled: cleanup.enabled, days: cleanup.days });
        setCleanupMessage('');
    };

    const runCleanupDry = async () => {
        setCleanupBusy(true);
        setCleanupMessage('');
        try {
            const r = await api('/admin/push/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: true },
            });
            setCleanupMessage(
                r.wouldDelete > 0
                    ? `🔍 Будет удалено: ${r.wouldDelete} подписок (старше ${r.days} дн.)`
                    : `✓ Неактивных подписок нет`
            );
        } catch (e) {
            setCleanupMessage('Ошибка: ' + e.message);
        } finally {
            setCleanupBusy(false);
        }
    };

    const runCleanupReal = async () => {
        setConfirmCleanup(false);
        setCleanupBusy(true);
        setCleanupMessage('');
        try {
            const r = await api('/admin/push/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: false },
            });
            setCleanupMessage(
                r.deleted > 0
                    ? `🗑️ Удалено: ${r.deleted} подписок (старше ${r.days} дн.)`
                    : `✓ Нечего удалять`
            );
            await reload();
        } catch (e) {
            setCleanupMessage('Ошибка: ' + e.message);
        } finally {
            setCleanupBusy(false);
        }
    };

    const allVisibleSelected =
        filteredSubs.length > 0 && filteredSubs.every((s) => selected.has(s.id));

    return (
        <div className="space-y-4">
            {/* ─── Статистика ─── */}
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
                            🔄
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

            {/* ─── Автоочистка неактивных ─── */}
            {cleanup ? (
                <div className="card p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <div className="font-bold text-lg">🧹 Автоочистка неактивных подписок</div>
                            <div className="text-sm text-white/50 mt-1">
                                Подписки, которые не получали уведомлений N дней, удаляются автоматически
                                раз в сутки в 04:00. Пользователь сможет подписаться заново.
                            </div>
                        </div>
                        {draftDirty && (
                            <span className="chip bg-orange-500/20 text-orange-300 text-[10px] shrink-0">
                                ● Есть несохранённые изменения
                            </span>
                        )}
                    </div>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={draft.enabled}
                            disabled={cleanupBusy}
                            onChange={(e) =>
                                setDraft((d) => ({ ...d, enabled: e.target.checked }))
                            }
                        />
                        <span>Включить автоочистку</span>
                    </label>

                    <div className="grid sm:grid-cols-[240px_1fr] gap-3 items-start">
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                                Считать неактивной (дней)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="730"
                                disabled={cleanupBusy}
                                className="input"
                                value={draft.days}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, days: Number(e.target.value) || 1 }))
                                }
                            />
                            <div className="text-[11px] text-white/40 mt-1">
                                От 1 до 730 дней. По умолчанию — 90.
                            </div>
                        </div>

                        <div className="rounded-2xl bg-ink-700/50 p-3">
                            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                                Предпросмотр
                            </div>
                            {cleanup.staleCount > 0 ? (
                                <div className="text-sm">
                                    Сейчас под критерий попадает{' '}
                                    <b className="text-orange-300">{cleanup.staleCount}</b> из{' '}
                                    {cleanup.total} подписок
                                </div>
                            ) : (
                                <div className="text-sm text-lime">
                                    ✓ Все {cleanup.total} подписок активны
                                </div>
                            )}
                            {draftDirty && draft.days !== cleanup.days && (
                                <div className="text-[11px] text-orange-300 mt-1">
                                    После сохранения будет применён новый порог ({draft.days} дн.).
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        <button
                            onClick={saveCleanupSettings}
                            disabled={cleanupBusy || !draftDirty}
                            className="btn-primary !py-2 text-sm"
                        >
                            {cleanupBusy ? '⏳' : '💾 Сохранить настройки'}
                        </button>
                        {draftDirty && (
                            <button
                                onClick={cancelCleanupChanges}
                                disabled={cleanupBusy}
                                className="btn-ghost !py-2 text-sm"
                            >
                                Отмена
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            onClick={runCleanupDry}
                            disabled={cleanupBusy}
                            className="btn-ghost !py-2 text-sm"
                        >
                            {cleanupBusy ? '⏳' : '🔍 Проверить (dry run)'}
                        </button>
                        <button
                            onClick={() => setConfirmCleanup(true)}
                            disabled={cleanupBusy || cleanup.staleCount === 0}
                            className="btn-primary !bg-pink !py-2 text-sm"
                        >
                            🗑️ Запустить сейчас
                        </button>
                    </div>

                    {cleanupMessage && (
                        <div className="mt-3 text-sm bg-white/5 rounded-xl p-3">
                            {cleanupMessage}
                        </div>
                    )}
                </div>
            ) : (
                <div className="card p-4 text-sm text-white/40">
                    Автоочистка недоступна. Проверьте, что роуты{' '}
                    <code className="font-mono">/admin/push/cleanup-settings</code> добавлены в{' '}
                    <code className="font-mono">admin.js</code> и сервер перезапущен.
                </div>
            )}

            {/* ─── Массовая рассылка ─── */}
            <div className="card p-5 space-y-3">
                <div className="font-bold">📣 Массовая рассылка</div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кому</label>
                    <div className="flex flex-wrap gap-2">
                        {[['all', '👥 Всем'], ['direction', '🎯 По направлению'], ['course', '📚 По курсу'], ['group', '🎓 По группе']].map(([v, l]) => (
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
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                )}
                {target === 'group' && (
                    <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                        <option value="">— выберите группу —</option>
                        {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}
                <input className="input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className="input resize-none" rows={3} placeholder="Текст уведомления" value={body} onChange={(e) => setBody(e.target.value)} />
                <input className="input" placeholder="URL (/app/chats/xxx)" value={url} onChange={(e) => setUrl(e.target.value)} />
                <button onClick={send} disabled={busy} className="btn-primary">
                    {busy ? 'Отправка…' : '🔔 Отправить push'}
                </button>
                {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}
                {result && (
                    <div className="text-sm text-lime bg-lime/10 rounded-xl p-3">
                        ✓ Получателей: {result.recipients} · Доставлено: {result.sent} · Ошибок: {result.failed}
                        {result.gone > 0 && ` · Удалено мёртвых: ${result.gone}`}
                    </div>
                )}
            </div>

            {/* ─── Управление подписками ─── */}
            <div className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                        <div className="font-bold text-lg">📋 Активные подписки</div>
                        <div className="text-sm text-white/50 mt-1">
                            Всего {subs.length}, сгруппировано по {grouped.length}{' '}
                            {grouped.length === 1 ? 'пользователю' : 'пользователям'}.
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={toggleSelectAll} disabled={filteredSubs.length === 0} className="btn-ghost !py-2 text-sm">
                            {allVisibleSelected ? '☑ Снять выделение' : '☐ Выбрать все'}
                        </button>
                        <button
                            onClick={requestDeleteSelected}
                            disabled={selected.size === 0}
                            className="btn-primary !bg-pink !py-2 text-sm"
                        >
                            🗑️ Удалить выбранные ({selected.size})
                        </button>
                    </div>
                </div>

                <input
                    className="input mb-4"
                    placeholder="Поиск по имени или @нику…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {subs.length === 0 && (
                    <div className="text-center text-white/40 text-sm py-8">
                        Пока никто не подписался на push-уведомления
                    </div>
                )}

                {subs.length > 0 && grouped.length === 0 && (
                    <div className="text-center text-white/40 text-sm py-8">
                        Ничего не найдено
                    </div>
                )}

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {grouped.map(({ user, subs: userSubs }) => {
                        const userSubIds = userSubs.map((s) => s.id);
                        const allUserSelected = userSubIds.every((id) => selected.has(id));
                        const someUserSelected = userSubIds.some((id) => selected.has(id));

                        return (
                            <div key={user.id} className="rounded-2xl bg-ink-700/40 border border-white/5 overflow-hidden">
                                <div className="px-3 py-2 flex items-center gap-3 border-b border-white/5 bg-ink-700/60">
                                    <input
                                        type="checkbox"
                                        checked={allUserSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = !allUserSelected && someUserSelected;
                                        }}
                                        onChange={() => toggleSelectUser(user.id)}
                                    />
                                    <Avatar user={user} size={32} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate">{user.fullName}</div>
                                        <div className="text-xs text-white/40 truncate">@{user.username}</div>
                                    </div>
                                    <span className="chip bg-white/5 text-[10px]">
                                        {userSubs.length}{' '}
                                        {userSubs.length === 1 ? 'устройство' : userSubs.length < 5 ? 'устройства' : 'устройств'}
                                    </span>
                                    <button
                                        onClick={() => requestDeleteUser(user, userSubs.length)}
                                        className="chip bg-white/5 hover:bg-pink/30 text-[10px]"
                                        title="Удалить все подписки пользователя"
                                    >
                                        🗑️ Удалить все
                                    </button>
                                </div>

                                <div className="divide-y divide-white/5">
                                    {userSubs.map((s) => {
                                        const ageDays = Math.floor(
                                            (Date.now() - new Date(s.lastUsed).getTime()) / 86400000
                                        );
                                        const isStale = cleanup && ageDays >= cleanup.days;

                                        return (
                                            <div key={s.id} className="px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(s.id)}
                                                    onChange={() => toggleSelect(s.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-mono text-white/60 truncate" title={s.endpoint}>
                                                        {s.endpoint}
                                                    </div>
                                                    <div className="text-[10px] text-white/30 mt-0.5">
                                                        {s.userAgent && <span className="truncate">{s.userAgent}</span>}
                                                        {s.userAgent && ' · '}
                                                        Активна: {new Date(s.lastUsed).toLocaleDateString('ru-RU')}
                                                        {' · '}
                                                        <span className={isStale ? 'text-orange-300' : ''}>
                                                            {ageDays} дн. назад
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => requestDeleteOne(s)}
                                                    disabled={deletingOne === s.id}
                                                    className="chip bg-white/5 hover:bg-pink/30 text-xs"
                                                    title="Удалить подписку"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Подтверждение удаления подписок ─── */}
            <ConfirmDialog
                open={!!confirmDelete}
                title={
                    confirmDelete?.type === 'one'
                        ? 'Удалить подписку?'
                        : confirmDelete?.type === 'user'
                            ? `Удалить все подписки ${confirmDelete?.user?.fullName}?`
                            : `Удалить ${confirmDelete?.ids?.length || 0} подписок?`
                }
                description={
                    confirmDelete?.type === 'one'
                        ? 'Устройство больше не будет получать push-уведомления. Пользователь сможет подписаться заново.'
                        : confirmDelete?.type === 'user'
                            ? `Будут удалены все ${confirmDelete?.count} подписок пользователя со всех устройств.`
                            : 'Выбранные устройства больше не будут получать push-уведомления.'
                }
                confirmLabel="Удалить"
                danger
                busy={deletingOne}
                onConfirm={doDelete}
                onCancel={() => !deletingOne && setConfirmDelete(null)}
            />

            {/* ─── Подтверждение автоочистки ─── */}
            <ConfirmDialog
                open={confirmCleanup}
                title="Запустить очистку сейчас?"
                description={
                    cleanup
                        ? `Будут удалены подписки старше ${cleanup.days} дней без активности. ` +
                        `Сейчас под критерий попадает ${cleanup.staleCount} из ${cleanup.total}. ` +
                        `Пользователи смогут подписаться заново.`
                        : ''
                }
                confirmLabel="Запустить"
                danger
                busy={cleanupBusy}
                onConfirm={runCleanupReal}
                onCancel={() => setConfirmCleanup(false)}
            />
        </div>
    );
}