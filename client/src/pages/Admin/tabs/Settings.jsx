import { useState } from 'react';
import { api } from '../../../api/client.js';

export default function Settings({ settings, setSettings, token }) {
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
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
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
                            <label className="text-xs text-white/40 uppercase tracking-wider">{label}</label>
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
                                moderation_auto_action_enabled: e.target.checked ? 'true' : 'false',
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
                                    moderation_auto_delete_threshold: String(e.target.value || 3),
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
                                    moderation_auto_ban_threshold: String(e.target.value || 5),
                                })
                            }
                        />
                        <div className="text-[11px] text-white/40 mt-1">
                            Уникальных жалоб → автор блокируется
                        </div>
                    </div>
                </div>

                <div className="text-xs text-white/40 mt-3">
                    Считаются уникальные жалобщики (не более одной жалобы на объект от пользователя).
                    Автобан приоритетнее автоудаления. Если порог меньше фактического числа — срабатывает
                    ближайшее действие.
                </div>
            </div>
        </div>
    );
}