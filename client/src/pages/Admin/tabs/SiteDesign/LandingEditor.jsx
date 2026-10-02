export default function LandingEditor({ settings, update }) {
    const features = (() => {
        try { return JSON.parse(settings.landing_features || '[]'); } catch { return []; }
    })();

    const updateFeature = (idx, patch) => update({ landing_features: JSON.stringify(features.map((f, i) => i === idx ? { ...f, ...patch } : f)) });
    const addFeature = () => update({ landing_features: JSON.stringify([...features, { icon: '✨', title: 'Новая фича', text: 'Описание' }]) });
    const removeFeature = (idx) => update({ landing_features: JSON.stringify(features.filter((_, i) => i !== idx)) });

    return (
        <div className="space-y-4">
            <div className="text-xs text-white/40 uppercase tracking-wider">Hero-секция</div>
            <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Бейдж</label>
                    <input className="input" value={settings.landing_hero_badge || ''} onChange={(e) => update({ landing_hero_badge: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (начало)</label>
                    <input className="input" value={settings.landing_hero_title_prefix || ''} onChange={(e) => update({ landing_hero_title_prefix: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (акцент)</label>
                    <input className="input" value={settings.landing_hero_title_accent || ''} onChange={(e) => update({ landing_hero_title_accent: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок (окончание)</label>
                    <input className="input" value={settings.landing_hero_title_suffix || ''} onChange={(e) => update({ landing_hero_title_suffix: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок</label>
                    <textarea rows={2} className="input resize-none" value={settings.landing_hero_subtitle || ''} onChange={(e) => update({ landing_hero_subtitle: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка 1</label>
                    <input className="input" value={settings.landing_hero_cta_primary || ''} onChange={(e) => update({ landing_hero_cta_primary: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка 2</label>
                    <input className="input" value={settings.landing_hero_cta_secondary || ''} onChange={(e) => update({ landing_hero_cta_secondary: e.target.value })} />
                </div>
            </div>

            <div className="text-xs text-white/40 uppercase tracking-wider pt-3">Фичи</div>
            <input className="input" value={settings.landing_features_title || ''} onChange={(e) => update({ landing_features_title: e.target.value })} placeholder="Заголовок секции" />

            <div className="space-y-2">
                {features.map((f, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[60px_1fr_1fr_auto] gap-2 items-start">
                        <input className="input !py-2 text-center text-lg" value={f.icon || ''} onChange={(e) => updateFeature(i, { icon: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Название" value={f.title || ''} onChange={(e) => updateFeature(i, { title: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Текст" value={f.text || ''} onChange={(e) => updateFeature(i, { text: e.target.value })} />
                        <button onClick={() => removeFeature(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
                <button onClick={addFeature} className="chip bg-white/5 hover:bg-white/10">＋ Добавить фичу</button>
            </div>

            <div className="text-xs text-white/40 uppercase tracking-wider pt-3">CTA</div>
            <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Заголовок CTA</label>
                    <input className="input" value={settings.landing_cta_title || ''} onChange={(e) => update({ landing_cta_title: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок CTA</label>
                    <input className="input" value={settings.landing_cta_subtitle || ''} onChange={(e) => update({ landing_cta_subtitle: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-white/40 uppercase block mb-1">Кнопка CTA</label>
                    <input className="input" value={settings.landing_cta_button || ''} onChange={(e) => update({ landing_cta_button: e.target.value })} />
                </div>
            </div>
        </div>
    );
}