export default function MenuEditor({ settings, update }) {
    const items = (() => {
        try { return JSON.parse(settings.nav_items || '[]'); } catch { return []; }
    })();

    const updateItem = (idx, patch) => update({ nav_items: JSON.stringify(items.map((it, i) => i === idx ? { ...it, ...patch } : it)) });
    const addItem = () => update({ nav_items: JSON.stringify([...items, { to: '/app/new', label: 'Новый раздел', icon: '✨' }]) });
    const removeItem = (idx) => update({ nav_items: JSON.stringify(items.filter((_, i) => i !== idx)) });
    const moveItem = (idx, dir) => {
        const arr = [...items];
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        update({ nav_items: JSON.stringify(arr) });
    };

    return (
        <div className="space-y-3">
            <div className="text-xs text-white/50">Пункты меню в сайдбаре и нижней навигации.</div>
            <div className="space-y-2">
                {items.map((it, i) => (
                    <div key={i} className="card p-3 grid grid-cols-[60px_1fr_1fr_auto_auto_auto] gap-2 items-center">
                        <input className="input !py-2 text-center text-lg" value={it.icon || ''} onChange={(e) => updateItem(i, { icon: e.target.value })} />
                        <input className="input !py-2 text-sm" placeholder="Название" value={it.label || ''} onChange={(e) => updateItem(i, { label: e.target.value })} />
                        <input className="input !py-2 text-sm font-mono" placeholder="/app/..." value={it.to || ''} onChange={(e) => updateItem(i, { to: e.target.value })} />
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="btn-ghost !p-1.5 text-xs disabled:opacity-30">↑</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="btn-ghost !p-1.5 text-xs disabled:opacity-30">↓</button>
                        <button onClick={() => removeItem(i)} className="text-white/40 hover:text-pink px-2">✕</button>
                    </div>
                ))}
            </div>
            <button onClick={addItem} className="chip bg-white/5 hover:bg-white/10">＋ Добавить пункт</button>
        </div>
    );
}