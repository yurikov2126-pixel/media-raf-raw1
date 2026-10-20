import { useState } from 'react';
import { api } from '../../../../api/client.js';
import BrandEditor from './BrandEditor.jsx';
import LandingEditor from './LandingEditor.jsx';
import MenuEditor from './MenuEditor.jsx';
import FooterEditor from './FooterEditor.jsx';
import CertificateEditor from './CertificateEditor.jsx';
import ThemeEditor from './ThemeEditor.jsx';
import AppExperienceEditor from './AppExperienceEditor.jsx';
import SitePreview from './SitePreview.jsx';

const SUBS = [
    ['brand', '🎨 Брендинг'],
    ['landing', '🏠 Лендинг'],
    ['menu', '🧭 Меню'],
    ['glass', '🫧 Жидкое стекло'],
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
            await onSaved?.();
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card p-5 mrr-admin-design">
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

            {preview && <SitePreview settings={settings} />}
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
            {sub === 'glass' && <div className="space-y-5 max-w-2xl">
                <div><div className="font-semibold">Стиль мобильного меню и «Ещё»</div><p className="text-sm opacity-65 mt-1">Меняется для мобильного сайта и установленного PWA. Настройки вступают в силу после сохранения.</p></div>
                <div className="grid grid-cols-2 gap-2">{[['classic','Классический'],['glass','Жидкое стекло']].map(([value,label]) => <button key={value} type="button" onClick={() => update({ nav_mobile_style:value })} className={`rounded-xl border p-4 text-sm font-semibold ${ (settings.nav_mobile_style || 'classic') === value ? 'border-violet bg-violet/20' : 'border-white/10 bg-white/5' }`}>{label}</button>)}</div>
                {[['nav_glass_opacity','Прозрачность стекла',15,95,64,'%'],['nav_glass_blur','Размытие фона',0,48,24,'px'],['nav_glass_saturation','Насыщенность',100,200,145,'%'],['nav_glass_border','Выраженность границы',0,90,45,'%']].map(([key,label,min,max,fallback,unit]) => <label key={key} className="block rounded-xl border p-3" style={{borderColor:'var(--border-strong)'}}><span className="flex justify-between text-sm mb-3"><span>{label}</span><strong>{settings[key] ?? fallback}{unit}</strong></span><input type="range" className="w-full accent-violet-500" min={min} max={max} step="1" value={settings[key] ?? fallback} onChange={e => update({[key]:e.target.value})} disabled={(settings.nav_mobile_style || 'classic') !== 'glass'}/></label>)}
            </div>}
            {sub === 'footer' && <FooterEditor settings={settings} update={update} />}
            {sub === 'certificate' && <CertificateEditor settings={settings} update={update} />}
            {sub === 'theme' && <ThemeEditor settings={settings} update={update} />}
            {sub === 'experience' && <AppExperienceEditor settings={settings} update={update} />}
        </div>
    );
}