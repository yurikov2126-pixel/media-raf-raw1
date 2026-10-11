import { useState } from 'react';
import { api } from '../../../../api/client.js';
import BrandEditor from './BrandEditor.jsx';
import LandingEditor from './LandingEditor.jsx';
import MenuEditor from './MenuEditor.jsx';
import FooterEditor from './FooterEditor.jsx';
import CertificateEditor from './CertificateEditor.jsx';
import ThemeEditor from './ThemeEditor.jsx';
import AppExperienceEditor from './AppExperienceEditor.jsx';

const SUBS = [
    ['brand', '🎨 Брендинг'],
    ['landing', '🏠 Лендинг'],
    ['menu', '🧭 Меню'],
    ['footer', '📄 Футер'],
    ['certificate', '🏆 Сертификаты'],
    ['theme', '🌓 Тема'],
    ['experience', '✨ Интерфейс'],
];

export default function SiteDesign({ settings, setSettings, token, onSaved }) {
    const [sub, setSub] = useState('brand');
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);

    const update = (patch) => {
        setSettings((s) => ({ ...s, ...patch }));
        setSaved(false);
    };

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            await api('/admin/settings', { method: 'PUT', token, body: settings });
            setSaved(true);
            onSaved?.();
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                    <div className="font-bold text-lg">🎨 Дизайн сайта</div>
                    <div className="text-sm text-white/50 mt-1">
                        Брендинг, лендинг, меню, футер, сертификаты, тема.
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn-ghost" onClick={() => setPreview(p => !p)} aria-expanded={preview}>{preview ? "Скрыть предпросмотр" : "Предпросмотр"}</button><button onClick={save} disabled={busy} className="btn-primary shrink-0">
                    {busy ? 'Сохранение…' : saved ? '✓ Сохранено' : '💾 Сохранить всё'}
                </button></div>
            </div>

            {error && <div className="mb-3 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}

            {preview && <section className="mb-5 rounded-2xl border border-white/15 overflow-hidden" aria-label="Предпросмотр оформления">
                <div className="bg-ink-700/70 px-4 py-2 text-xs text-white/60 border-b border-white/10">Локальный предпросмотр — изменения ещё не опубликованы</div>
                <div className="p-5 space-y-4" style={{ fontSize: `${Number(settings.ui_font_scale || 1) * 100}%` }}>
                    <div className="flex flex-wrap items-center gap-3"><div className="h-10 w-10 rounded-xl bg-violet/25 grid place-items-center">📷</div><div><h3 className="font-bold">{settings.site_name || 'Media_РАФ_RAW'}</h3><p className="text-xs opacity-60">{settings.dashboard_welcome_subtitle || 'Рабочее пространство медиацентра'}</p></div></div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-wider opacity-50">Главная</p><h4 className="font-semibold mt-1">{settings.dashboard_welcome_title || 'Твоя медиа-команда в одном месте'}</h4><p className="text-sm opacity-60 mt-1">Пример карточки с выбранными настройками</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg bg-violet/25 px-3 py-2 text-sm">Открыть проект</span><span className="rounded-lg border border-white/20 px-3 py-2 text-sm">Подробнее</span></div></div>
                </div>
            </section>}
            <div className="flex gap-2 flex-wrap mb-4">
                {SUBS.map(([v, l]) => (
                    <button
                        key={v}
                        onClick={() => setSub(v)}
                        className={`chip ${sub === v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                    >
                        {l}
                    </button>
                ))}
            </div>

            {sub === 'brand' && <BrandEditor settings={settings} update={update} />}
            {sub === 'landing' && <LandingEditor settings={settings} update={update} />}
            {sub === 'menu' && <MenuEditor settings={settings} update={update} />}
            {sub === 'footer' && <FooterEditor settings={settings} update={update} />}
            {sub === 'certificate' && <CertificateEditor settings={settings} update={update} />}
            {sub === 'theme' && <ThemeEditor settings={settings} update={update} />}
            {sub === 'experience' && <AppExperienceEditor settings={settings} update={update} />}
        </div>
    );
}