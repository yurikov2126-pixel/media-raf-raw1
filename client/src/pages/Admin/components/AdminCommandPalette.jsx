import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client.js';
import Avatar from '../../../components/Avatar.jsx';
import { TABS } from '../constants.js';

const DEBOUNCE_MS = 300;

export default function AdminCommandPalette({ token, onClose }) {
    const [, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [serverResults, setServerResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const inputRef = useRef(null);
    const listRef = useRef(null);
    const debounceRef = useRef(null);

    // Фокус при открытии
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Дебаунс-запрос к серверу
    useEffect(() => {
        const q = query.trim();
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (q.length < 2) {
            setServerResults(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const r = await api(`/admin/search?q=${encodeURIComponent(q)}`, { token });
                setServerResults(r);
            } catch {
                setServerResults(null);
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, token]);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        const out = [];

        // ─── Разделы админки (всегда, при пустом или любом запросе) ───
        const tabs = TABS.filter(([, label]) => !q || label.toLowerCase().includes(q));
        for (const [key, label, icon] of tabs.slice(0, q ? 5 : 10)) {
            out.push({
                kind: 'tab',
                key: `tab:${key}`,
                section: 'Разделы',
                icon,
                label,
                onSelect: () => setSearchParams({ tab: key }, { replace: true }),
            });
        }

        // ─── Результаты с сервера ───
        if (serverResults) {
            for (const u of serverResults.users || []) {
                out.push({
                    kind: 'user',
                    key: `user:${u.id}`,
                    section: 'Пользователи',
                    user: u,
                    label: u.fullName,
                    sub: `@${u.username}${u.isBanned ? ' · забанен' : ''}`,
                    onSelect: () =>
                        setSearchParams({ tab: 'users', q: u.username }, { replace: true }),
                });
            }

            for (const c of serverResults.courses || []) {
                out.push({
                    kind: 'course',
                    key: `course:${c.id}`,
                    section: 'Курсы',
                    icon: '📚',
                    label: c.title,
                    sub: `${c.slug}${c.published ? '' : ' · черновик'}`,
                    onSelect: () => setSearchParams({ tab: 'courses' }, { replace: true }),
                });
            }

            for (const p of serverResults.posts || []) {
                out.push({
                    kind: 'post',
                    key: `post:${p.id}`,
                    section: 'Посты',
                    icon: '📝',
                    label: p.excerpt || '(без текста)',
                    sub: `@${p.author.username}${p.hasMedia ? ' · с медиа' : ''}`,
                    onSelect: () =>
                        setSearchParams(
                            { tab: 'users', q: p.author.username },
                            { replace: true }
                        ),
                });
            }

            for (const cert of serverResults.certificates || []) {
                out.push({
                    kind: 'certificate',
                    key: `cert:${cert.id}`,
                    section: 'Сертификаты',
                    icon: '🏆',
                    label: cert.serial,
                    sub: `${cert.user.fullName} · ${cert.course.title}`,
                    onSelect: () => {
                        navigate(`/verify/${cert.serial}`);
                    },
                });
            }

            for (const w of serverResults.wiki || []) {
                out.push({
                    kind: 'wiki',
                    key: `wiki:${w.id}`,
                    section: 'Wiki',
                    icon: '📖',
                    label: w.title,
                    sub: `${w.slug}${w.published ? '' : ' · черновик'}`,
                    onSelect: () => {
                        navigate(`/app/wiki/${w.slug}`);
                    },
                });
            }
        }

        return out;
    }, [query, serverResults, setSearchParams, navigate]);

    // Сброс активного индекса при новом списке
    useEffect(() => {
        setActiveIndex(0);
    }, [query, serverResults]);

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

    // Группировка по секциям, сохраняя порядок items
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
                    <span className="text-xl shrink-0">
                        {loading ? '⏳' : '🔍'}
                    </span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Раздел, пользователь, курс, пост, сертификат, вики…"
                        className="flex-1 bg-transparent border-0 outline-none text-white text-base placeholder:text-white/30"
                    />
                    <kbd className="text-[10px] text-white/40 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                        ESC
                    </kbd>
                </div>

                <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
                    {items.length === 0 && !loading && query.length >= 2 && (
                        <div className="px-4 py-8 text-center text-white/40 text-sm">
                            Ничего не найдено
                        </div>
                    )}
                    {items.length === 0 && !loading && query.length < 2 && (
                        <div className="px-4 py-8 text-center text-white/40 text-sm">
                            Начните вводить для поиска
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
                                            active ? 'bg-violet/20' : 'hover:bg-white/5'
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
                                            <div className="text-sm truncate">{it.label}</div>
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