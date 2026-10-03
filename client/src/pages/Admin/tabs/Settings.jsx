import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function Settings({ settings, setSettings, token }) {
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);

    // Автоочистка уведомлений — с сервера
    const [notifyCleanup, setNotifyCleanup] = useState(null);
    const [notifyDraft, setNotifyDraft] = useState({ enabled: false, days: 90 });
    const [notifyBusy, setNotifyBusy] = useState(false);
    const [notifyMsg, setNotifyMsg] = useState('');
    const [confirmNotify, setConfirmNotify] = useState(false);

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
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const loadNotifyCleanup = async () => {
        try {
            const r = await api('/admin/notifications/cleanup-settings', { token });
            setNotifyCleanup(r);
            setNotifyDraft({ enabled: r.enabled, days: r.days });
        } catch (e) {
            setNotifyCleanup(null);
        }
    };

    useEffect(() => {
        loadNotifyCleanup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const notifyDirty =
        notifyCleanup &&
        (notifyDraft.enabled !== notifyCleanup.enabled ||
            notifyDraft.days !== notifyCleanup.days);

    const saveNotifySettings = async () => {
        if (!notifyDirty) return;
        setNotifyBusy(true);
        setNotifyMsg('');
        try {
            await api('/admin/settings', {
                method: 'PUT',
                token,
                body: {
                    notifications_cleanup_enabled: notifyDraft.enabled ? 'true' : 'false',
                    notifications_cleanup_days: String(notifyDraft.days),
                },
            });
            await loadNotifyCleanup();
            setNotifyMsg('✓ Настройки сохранены');
            setTimeout(() => setNotifyMsg(''), 2500);
        } catch (e) {
            setNotifyMsg('Ошибка: ' + e.message);
        } finally {
            setNotifyBusy(false);
        }
    };

    const runNotifyCleanupDry = async () => {
        setNotifyBusy(true);
        setNotifyMsg('');
        try {
            const r = await api('/admin/notifications/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: true },
            });
            setNotifyMsg(
                r.wouldDelete > 0
                    ? `🔍 Будет удалено: ${r.wouldDelete} прочитанных уведомлений (старше ${r.days} дн.)`
                    : `✓ Нечего удалять`
            );
        } catch (e) {
            setNotifyMsg('Ошибка: ' + e.message);
        } finally {
            setNotifyBusy(false);
        }
    };

    const runNotifyCleanupReal = async () => {
        setConfirmNotify(false);
        setNotifyBusy(true);
        setNotifyMsg('');
        try {
            const r = await api('/admin/notifications/cleanup-now', {
                method: 'POST',
                token,
                body: { dryRun: false },
            });
            setNotifyMsg(
                r.deleted > 0
                    ? `🗑️ Удалено: ${r.deleted} уведомлений (старше ${r.days} дн.)`
                    : `✓ Нечего удалять`
            );
            await loadNotifyCleanup();
        } catch (e) {
            setNotifyMsg('Ошибка: ' + e.message);
        } finally {
            setNotifyBusy(false);
        }
    };

    const autoEnabled = settings.moderation_auto_action_enabled === 'true';
    const deleteThreshold = Number(settings.moderation_auto_delete_threshold) || 3;
    const banThreshold = Number(settings.moderation_auto_ban_threshold) || 5;

    return (
        <div className="space-y-5">
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
                    {[
                        ['site_name', 'Название сайта'],
                        ['site_description', 'Описание'],
                        ['contact_email', 'Email'],
                        ['radio_stream_url', 'Стрим Radio Политех-FM'],
                        ['vk_link', 'VK'],
                        ['tg_link', 'Telegram'],
                    ].map(([key, label]) => (
                        <div key={key}>
                            <label className="text-xs text-white/40 uppercase tracking-wider">
                                {label}
                            </label>
                            <input
                                className="input mt-1"
                                value={settings[key] || ''}
                                onChange={(e) => update({ [key]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Автомодерация ─── */}
            <div className="card p-5">
                <div className="font-bold text-lg mb-1">🛡️ Автомодерация</div>
                <div className="text-sm text-white/50 mb-4">
                    Автоматические действия при множественных жалобах от разных пользователей
                    на один объект.
                </div>

                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={autoEnabled}
                        onChange={(e) =>
                            update({
                                moderation_auto_action_enabled: e.target.checked
                                    ? 'true'
                                    : 'false',
                            })
                        }
                    />
                    <span>Включить автомодерацию</span>
                </label>

                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Порог автоудаления
                        </label>
                        <input
                            type="number"
                            min="2"
                            max="20"
                            disabled={!autoEnabled}
                            className="input disabled:opacity-40"
                            value={deleteThreshold}
                            onChange={(e) =>
                                update({
                                    moderation_auto_delete_threshold: String(
                                        e.target.value || 3
                                    ),
                                })
                            }
                        />
                        <div className="text-[11px] text-white/40 mt-1">
                            Уникальных жалоб → контент удаляется
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Порог автобана
                        </label>
                        <input
                            type="number"
                            min="2"
                            max="50"
                            disabled={!autoEnabled}
                            className="input disabled:opacity-40"
                            value={banThreshold}
                            onChange={(e) =>
                                update({
                                    moderation_auto_ban_threshold: String(
                                        e.target.value || 5
                                    ),
                                })
                            }
                        />
                        <div className="text-[11px] text-white/40 mt-1">
                            Уникальных жалоб → автор блокируется
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Автоочистка уведомлений ─── */}
            {notifyCleanup && (
                <div className="card p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <div className="font-bold text-lg">🔔 Автоочистка уведомлений</div>
                            <div className="text-sm text-white/50 mt-1">
                                Удаляет старые <b>прочитанные</b> уведомления. Непрочитанные
                                никогда не удаляются — важное не потеряется.
                            </div>
                        </div>
                        {notifyDirty && (
                            <span className="chip bg-orange-500/20 text-orange-300 text-[10px] shrink-0">
                                ● Есть несохранённые изменения
                            </span>
                        )}
                    </div>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifyDraft.enabled}
                            disabled={notifyBusy}
                            onChange={(e) =>
                                setNotifyDraft((d) => ({ ...d, enabled: e.target.checked }))
                            }
                        />
                        <span>Включить автоочистку (запуск раз в сутки в 04:30)</span>
                    </label>

                    <div className="grid sm:grid-cols-[240px_1fr] gap-3 items-start">
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                                Хранить прочитанные (дней)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="730"
                                disabled={notifyBusy}
                                className="input"
                                value={notifyDraft.days}
                                onChange={(e) =>
                                    setNotifyDraft((d) => ({
                                        ...d,
                                        days: Number(e.target.value) || 1,
                                    }))
                                }
                            />
                            <div className="text-[11px] text-white/40 mt-1">
                                От 1 до 730. По умолчанию — 90.
                            </div>
                        </div>

                        <div className="rounded-2xl bg-ink-700/50 p-3">
                            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                                Состояние сейчас
                            </div>
                            <div className="text-sm space-y-0.5">
                                <div>
                                    Всего уведомлений:{' '}
                                    <b>{notifyCleanup.total.toLocaleString('ru-RU')}</b>
                                </div>
                                <div>
                                    Прочитанных:{' '}
                                    <b>{notifyCleanup.totalRead.toLocaleString('ru-RU')}</b>
                                </div>
                                <div>
                                    Непрочитанных:{' '}
                                    <b className="text-violet-soft">
                                        {notifyCleanup.totalUnread.toLocaleString('ru-RU')}
                                    </b>
                                </div>
                                {notifyCleanup.staleRead > 0 && (
                                    <div className="text-orange-300">
                                        Под очистку сейчас:{' '}
                                        <b>{notifyCleanup.staleRead.toLocaleString('ru-RU')}</b>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        <button
                            onClick={saveNotifySettings}
                            disabled={notifyBusy || !notifyDirty}
                            className="btn-primary !py-2 text-sm"
                        >
                            {notifyBusy ? '⏳' : '💾 Сохранить настройки'}
                        </button>
                        {notifyDirty && (
                            <button
                                onClick={() => {
                                    setNotifyDraft({
                                        enabled: notifyCleanup.enabled,
                                        days: notifyCleanup.days,
                                    });
                                    setNotifyMsg('');
                                }}
                                disabled={notifyBusy}
                                className="btn-ghost !py-2 text-sm"
                            >
                                Отмена
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            onClick={runNotifyCleanupDry}
                            disabled={notifyBusy}
                            className="btn-ghost !py-2 text-sm"
                        >
                            {notifyBusy ? '⏳' : '🔍 Проверить'}
                        </button>
                        <button
                            onClick={() => setConfirmNotify(true)}
                            disabled={notifyBusy || notifyCleanup.staleRead === 0}
                            className="btn-primary !bg-pink !py-2 text-sm"
                        >
                            🗑️ Запустить сейчас
                        </button>
                    </div>

                    {notifyMsg && (
                        <div className="mt-3 text-sm bg-white/5 rounded-xl p-3">
                            {notifyMsg}
                        </div>
                    )}

                    {confirmNotify && (
                        <div
                            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
                            onClick={() => !notifyBusy && setConfirmNotify(false)}
                        >
                            <div
                                className="card max-w-lg w-full p-5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="text-2xl mb-2">⚠️</div>
                                <h3 className="text-xl font-bold mb-3">
                                    Запустить очистку уведомлений?
                                </h3>
                                <p className="text-sm text-white/70 mb-4">
                                    Будут удалены прочитанные уведомления старше{' '}
                                    {notifyCleanup.days} дней.
                                    Сейчас под критерий попадает{' '}
                                    <b>{notifyCleanup.staleRead}</b> уведомлений.
                                    Непрочитанные не затрагиваются.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setConfirmNotify(false)}
                                        disabled={notifyBusy}
                                        className="btn-ghost"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={runNotifyCleanupReal}
                                        disabled={notifyBusy}
                                        className="btn-primary !bg-pink"
                                    >
                                        {notifyBusy ? '…' : 'Запустить'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}