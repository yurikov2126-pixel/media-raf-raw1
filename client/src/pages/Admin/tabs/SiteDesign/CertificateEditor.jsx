import { TEMPLATES } from '../../constants.js';

export default function CertificateEditor({ settings, update }) {
    const tpl = settings.certificate_template || 'gradient';
    const accent1 = settings.certificate_accent_1 || '#7C3AED';
    const accent2 = settings.certificate_accent_2 || '#EC4899';

    const previewBg = (() => {
        switch (tpl) {
            case 'classic': return '#fdfaf3';
            case 'dark': return '#0b0b14';
            case 'minimal': return '#ffffff';
            default: return `linear-gradient(135deg, ${accent1} 0%, ${accent2} 100%)`;
        }
    })();
    const previewText = tpl === 'classic' || tpl === 'minimal' ? '#1a1a1a' : '#ffffff';

    return (
        <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Шаблон</label>
                    <select className="input" value={tpl} onChange={(e) => update({ certificate_template: e.target.value })}>
                        {TEMPLATES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Акцент 1</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" value={accent1} onChange={(e) => update({ certificate_accent_1: e.target.value })} className="w-12 h-10 rounded-lg bg-transparent border border-white/10" />
                            <input className="input flex-1" value={accent1} onChange={(e) => update({ certificate_accent_1: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase block mb-1">Акцент 2</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" value={accent2} onChange={(e) => update({ certificate_accent_2: e.target.value })} className="w-12 h-10 rounded-lg bg-transparent border border-white/10" />
                            <input className="input flex-1" value={accent2} onChange={(e) => update({ certificate_accent_2: e.target.value })} />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Название организации</label>
                    <input className="input" value={settings.certificate_org_name || ''} onChange={(e) => update({ certificate_org_name: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Подзаголовок</label>
                    <input className="input" value={settings.certificate_subtitle || ''} onChange={(e) => update({ certificate_subtitle: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Подпись</label>
                    <input className="input" value={settings.certificate_signature || ''} onChange={(e) => update({ certificate_signature: e.target.value })} />
                </div>
            </div>
            <div>
                <div className="text-xs text-white/40 uppercase mb-2">Превью</div>
                <div className="rounded-2xl p-6 relative overflow-hidden min-h-[280px] flex flex-col justify-between" style={{ background: previewBg, color: previewText }}>
                    <div>
                        <div className="text-xs uppercase tracking-widest opacity-70">{settings.certificate_org_name || 'MEDIA·RAF·RAW'}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-50 mt-0.5">{settings.certificate_subtitle || 'Студенческий медиацентр'}</div>
                    </div>
                    <div className="text-center my-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">Сертификат</div>
                        <div className="text-xs opacity-80 mb-3">подтверждает, что</div>
                        <div className="text-xl font-extrabold">Иван Иванов</div>
                        <div className="text-xs opacity-80 mt-2">успешно прошёл(ла) курс</div>
                        <div className="text-sm font-bold mt-1">«Название курса»</div>
                    </div>
                    <div className="flex justify-between items-end text-[10px]">
                        <div>
                            <div className="uppercase tracking-widest opacity-60">Дата</div>
                            <div className="font-semibold">{new Date().toLocaleDateString('ru-RU')}</div>
                        </div>
                        <div className="text-2xl">🏆</div>
                        <div className="text-right">
                            <div className="uppercase tracking-widest opacity-60">Серийный №</div>
                            <div className="font-mono font-semibold">MRR-2025-ABC123</div>
                            {settings.certificate_signature && <div className="opacity-60 mt-1">{settings.certificate_signature}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}