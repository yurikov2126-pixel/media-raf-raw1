import { useState } from 'react';

export default function SearchSelect({ items, value, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const selected = items.find((i) => i.id === value);
    const filtered = items.filter((i) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return i.label.toLowerCase().includes(s) || (i.sub || '').toLowerCase().includes(s);
    });
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="input w-full text-left flex items-center justify-between"
            >
                {selected ? (
                    <span className="truncate">
                        {selected.label}
                        {selected.sub && <span className="text-white/40 text-xs ml-2">{selected.sub}</span>}
                    </span>
                ) : (
                    <span className="text-white/40">{placeholder}</span>
                )}
                <span className="text-white/40 ml-2">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-10 mt-1 w-full card p-2 max-h-64 overflow-y-auto">
                    <input
                        autoFocus
                        className="input !py-2 mb-2"
                        placeholder="Поиск…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    {filtered.length === 0 && (
                        <div className="text-center text-white/40 text-sm py-2">Ничего не найдено</div>
                    )}
                    {filtered.map((i) => (
                        <button
                            key={i.id}
                            type="button"
                            onClick={() => { onChange(i.id); setOpen(false); setQ(''); }}
                            className={`w-full text-left p-2 rounded-xl hover:bg-white/5 ${i.id === value ? 'bg-violet/20' : ''}`}
                        >
                            <div className="font-semibold text-sm">{i.label}</div>
                            {i.sub && <div className="text-xs text-white/40">{i.sub}</div>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}