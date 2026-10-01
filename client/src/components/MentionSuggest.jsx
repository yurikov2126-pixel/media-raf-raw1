import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar.jsx';

/**
 * props:
 *   query        — строка после @ (что ввёл пользователь)
 *   members      — массив участников чата
 *   onSelect(u)  — колбэк выбора участника
 *   onClose()    — закрыть
 */
export default function MentionSuggest({ query, members, onSelect, onClose }) {
    const [active, setActive] = useState(0);
    const list = useMemo(() => {
        const q = (query || '').toLowerCase();
        return members
            .filter((m) => m.username.toLowerCase().startsWith(q))
            .slice(0, 6);
    }, [query, members]);

    useEffect(() => { setActive(0); }, [query]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, list.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (list[active]) {
                    e.preventDefault();
                    onSelect(list[active]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [list, active, onSelect, onClose]);

    if (list.length === 0) return null;

    return (
        <div className="card p-1 max-h-56 overflow-y-auto animate-pop">
            <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 py-1">
                Упоминание
            </div>
            {list.map((m, i) => (
                <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left ${
                        i === active ? 'bg-violet/20' : 'hover:bg-white/5'
                    }`}
                >
                    <Avatar user={m} size={28} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{m.fullName}</div>
                        <div className="text-[10px] text-white/40 truncate">@{m.username}</div>
                    </div>
                </button>
            ))}
        </div>
    );
}