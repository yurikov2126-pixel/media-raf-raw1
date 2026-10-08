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
                <button onClick={save} disabled={busy} className="btn-primary shrink-0">
                    {busy ? 'Сохранение…' : saved ? '✓ Сохранено' : '💾 Сохранить всё'}
                </button>
            </div>

            {error && <div className="mb-3 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}

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