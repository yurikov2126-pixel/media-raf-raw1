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
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <div className="font-bold text-lg">⚙️ Системные настройки</div>
                    <div className="text-sm text-white/50 mt-1">Название, описание, контакты, стрим и соцсети.</div>
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
    );
}