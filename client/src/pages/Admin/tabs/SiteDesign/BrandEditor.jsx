export default function BrandEditor({ settings, update }) {
    return (
        <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label className="text-xs text-white/40 uppercase block mb-1">Логотип (текст)</label>
                <input className="input" value={settings.brand_logo_text || ''} onChange={(e) => update({ brand_logo_text: e.target.value })} />
            </div>
            <div className="md:col-span-2">
                <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок логотипа</label>
                <input className="input" value={settings.brand_logo_subtitle || ''} onChange={(e) => update({ brand_logo_subtitle: e.target.value })} />
            </div>
            <div className="md:col-span-2">
                <div className="text-xs text-white/40 uppercase mb-1">Акцентные цвета</div>
                <div className="grid grid-cols-3 gap-2">
                    {['brand_accent_1', 'brand_accent_2', 'brand_accent_3'].map((k, i) => (
                        <div key={k}>
                            <label className="text-[10px] text-white/40 uppercase block mb-1">Цвет {i + 1}</label>
                            <div className="flex gap-1 items-center">
                                <input type="color" value={settings[k] || '#7C3AED'} onChange={(e) => update({ [k]: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border border-white/10 shrink-0" />
                                <input className="input flex-1 text-xs" value={settings[k] || ''} onChange={(e) => update({ [k]: e.target.value })} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="md:col-span-2">
                <div className="text-xs text-white/40 uppercase mb-1">Превью градиента</div>
                <div className="h-20 rounded-2xl" style={{ backgroundImage: `linear-gradient(135deg, ${settings.brand_accent_1 || '#7C3AED'} 0%, ${settings.brand_accent_2 || '#EC4899'} 50%, ${settings.brand_accent_3 || '#06B6D4'} 100%)` }} />
            </div>
        </div>
    );
}