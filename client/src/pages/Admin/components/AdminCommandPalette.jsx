import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Avatar from '../../../components/Avatar.jsx';
import { TABS } from '../constants.js';

export default function AdminCommandPalette({ users = [], courses = [], onClose }) {
    const [, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        const result = [];

        // ─── Разделы ───
        const tabs = TABS.filter(
            ([, label]) => !q || label.toLowerCase().includes(q)
        );
        for (const [key, label, icon] of tabs.slice(0, 10)) {
            result.push({
                kind: 'tab',
                key: `tab:${key}`,
                section: 'Разделы',
                icon,
                label,
                onSelect: () => {
                    setSearchParams({ tab: key }, { replace: true });
                },
            });
        }

        // Пользователей и курсы ищем только при непустом запросе,
        // чтобы не заваливать список «всеми подряд» на пустом инпуте.
        if (q) {
            const matchedUsers = users
                .filter(
                    (u) =>
                        u.fullName.toLowerCase().includes(q) ||
                        u.username.toLowerCase().includes(q)
                )
                .slice(0, 5);
            for (const u of matchedUsers) {
                result.push({
                    kind: 'user',
                    key: `user:${u.id}`,
                    section: 'Пользователи',
                    user: u,
                    label: u.fullName,
                    sub: `@${u.username}`,
                    onSelect: () => {
                        // Переходим на вкладку Users и подставляем поиск.
                        // URL-фильтры в Users.jsx уже читают ?q=…
                        setSearchParams(
                            { tab: 'users', q: u.username },
                            { replace: true }
                        );
                    },
                });
            }

            const matchedCourses = courses
                .filter(
                    (c) =>
                        c.title.toLowerCase().includes(q) ||
                        (c.slug || '').toLowerCase().includes(q)
                )
                .slice(0, 5);
            for (const c of matchedCourses) {
                result.push({
                    kind: 'course',
                    key: `course:${c.id}`,
                    section: 'Курсы',
                    icon: '📚',
                    label: c.title,
                    sub: c.slug,
                    onSelect: () => {
                        setSearchParams({ tab: 'courses' }, { replace: true });
                    },
                });
            }
        }

        return result;
    }, [query, users, courses, setSearchParams]);

    // Сброс активного индекса при новом списке
    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    // Автоскролл к активному пункту
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const it = items[activeIndex];
            if (it) {
                it.onSelect();
                onClose();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    // Группировка по секциям для рендера: сохраняем исходный порядок items.
    const grouped = useMemo(() => {
        const map = new Map();
        items.forEach((it, idx) => {
            if (!map.has(it.section)) map.set(it.section, []);
            map.get(it.section).push({ ...it, _idx: idx });
        });
        return [...map.entries()];
    }, [items]);

    return (
        <div
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4 pt-[10vh] overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="card max-w-xl mx-auto overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                    <span className="text-xl shrink-0">🔍</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Раздел, пользователь, курс…"
                        className="flex-1 bg-transparent border-0 outline-none text-white text-base placeholder:text-white/30"
                    />
                    <kbd className="text-[10px] text-white/40 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                        ESC
                    </kbd>
                </div>

                <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
                    {items.length === 0 && (
                        <div className="px-4 py-8 text-center text-white/40 text-sm">
                            Ничего не найдено
                        </div>
                    )}
                    {grouped.map(([section, list]) => (
                        <div key={section}>
                            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                                {section}
                            </div>
                            {list.map((it) => {
                                const active = it._idx === activeIndex;
                                return (
                                    <button
                                        key={it.key}
                                        type="button"
                                        data-idx={it._idx}
                                        onMouseEnter={() => setActiveIndex(it._idx)}
                                        onClick={() => {
                                            it.onSelect();
                                            onClose();
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${
                                            active
                                                ? 'bg-violet/20'
                                                : 'hover:bg-white/5'
                                        }`}
                                    >
                                        {it.user ? (
                                            <Avatar user={it.user} size={24} />
                                        ) : (
                                            <span className="text-lg w-6 text-center shrink-0">
                                                {it.icon}
                                            </span>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm truncate">
                                                {it.label}
                                            </div>
                                            {it.sub && (
                                                <div className="text-xs text-white/40 truncate">
                                                    {it.sub}
                                                </div>
                                            )}
                                        </div>
                                        {active && (
                                            <span className="text-[10px] text-white/40 shrink-0">
                                                Enter
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/40 flex items-center gap-4 flex-wrap">
                    <span>↑↓ навигация</span>
                    <span>Enter — выбрать</span>
                    <span>ESC — закрыть</span>
                </div>
            </div>
        </div>
    );
}