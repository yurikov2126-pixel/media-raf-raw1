export default function FooterEditor({ settings, update }) {
    const links = (() => {
        try { return JSON.parse(settings.footer_links || '[]'); } catch { return []; }
    })();

    const updateLink = (idx, patch) => update({ footer_links: JSON.stringify(links.map((l, i) => i === idx ? { ...l, ...patch } : l)) });
    const addLink = () => update({ footer_links: JSON.stringify([...links, { label: 'Ссылка', url: 'https://' }]) });
    const removeLink = (idx) => update({ footer_links: JSON.stringify(links.filter((_, i) => i !== idx)) });

    return (
        <div className="space-y-3">
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Описание</label>
                <input className="input" value={settings.footer_description || ''} onChange={(e) => update({ footer_description: e.target.value })} />
            </div>
            <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Копирайт</label>
                <input className="input" value={settings.footer_copyright || ''} onChange={(e) => update({ footer_copyright: e.target.value })} />
            </div>
            <div className="text-xs text-white/40 uppercase tracking-wider pt-2">Ссылки</div>
            <div className="space-y-2">
                {links.map((l, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                        <input className="input !py-2 text-sm" placeholder="Название" value={l.label || ''} onChange={(e) => updateLink(i, { label: e.target.value })} />
                        <input className="input !py-2 text-sm font-mono" placeholder="https://" value={l.url || ''} onChange={(e) => updateLink(i, { url: e.target.value })} />
                        <button onClick={() => removeLink(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
            </div>
            <button onClick={addLink} className="chip bg-white/5 hover:bg-white/10">＋ Добавить ссылку</button>
        </div>
    );
}