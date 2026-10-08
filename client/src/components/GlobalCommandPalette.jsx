import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../store/settings.jsx';
import { useAuth } from '../store/auth.jsx';
import Icon from './Icon.jsx';

const baseCommands = [
    { id: 'home', title: 'Главная', sub: 'Рабочее пространство', icon: 'dashboard', to: '/app', keywords: 'главная dashboard' },
    { id: 'feed', title: 'Лента', sub: 'Публикации команды', icon: 'feed', to: '/app/feed', keywords: 'лента пост публикации' },
    { id: 'chats', title: 'Чаты', sub: 'Команда и сообщения', icon: 'message', to: '/app/chats', keywords: 'чаты сообщения мессенджер' },
    { id: 'courses', title: 'Обучение', sub: 'Курсы и уроки', icon: 'book', to: '/app/courses', keywords: 'курсы обучение уроки' },
    { id: 'wiki', title: 'Wiki', sub: 'База знаний', icon: 'book', to: '/app/wiki', keywords: 'wiki вики знания' },
    { id: 'notifications', title: 'Уведомления', sub: 'Центр событий', icon: 'bell', to: '/app/notifications', keywords: 'уведомления события' },
    { id: 'leaderboard', title: 'Рейтинг', sub: 'XP и достижения', icon: 'trophy', to: '/app/leaderboard', keywords: 'рейтинг xp достижения' },
    { id: 'profile', title: 'Мой профиль', sub: 'Портфолио и настройки', icon: 'user', keywords: 'профиль портфолио' },
];

export default function GlobalCommandPalette() {
    const { commandPalette } = useSettings();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef(null);

    const commands = useMemo(() => {
        const result = [...baseCommands];
        if (user?.role === 'MENTOR' || user?.role === 'ADMIN') {
            result.push({ id: 'mentor', title: 'Кабинет руководителя', sub: 'Практики и проверка', icon: 'users', to: '/app/mentor', keywords: 'руководитель mentor' });
        }
        if (user?.role === 'ADMIN') {
            result.push({ id: 'admin', title: 'Админ-панель', sub: 'Управление платформой', icon: 'settings', to: '/app/admin', keywords: 'админ администрация настройки' });
        }
        return result;
    }, [user?.role]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter((item) =>
            `${item.title} ${item.sub} ${item.keywords}`.toLowerCase().includes(q)
        );
    }, [commands, query]);

    const close = () => {
        setOpen(false);
        setQuery('');
        setSelected(0);
    };

    useEffect(() => {
        if (!commandPalette.enabled) return undefined;
        const onOpen = () => setOpen(true);
        const onKey = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((value) => !value);
            }
        };
        window.addEventListener('mrr:command-open', onOpen);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mrr:command-open', onOpen);
            window.removeEventListener('keydown', onKey);
        };
    }, [commandPalette.enabled]);

    useEffect(() => {
        if (!open) return;
        setTimeout(() => inputRef.current?.focus(), 0);
        const onKey = (event) => {
            if (event.key === 'Escape') close();
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((value) => Math.min(value + 1, Math.max(0, filtered.length - 1)));
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((value) => Math.max(value - 1, 0));
            }
            if (event.key === 'Enter' && filtered[selected]) {
                event.preventDefault();
                navigate(filtered[selected].to);
                close();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, filtered, selected, navigate]);

    useEffect(() => {
        if (!open) return;
        setSelected(0);
    }, [query, open]);

    if (!commandPalette.enabled || !open) return null;

    return (
        <div className="ui-command-overlay" role="dialog" aria-modal="true" aria-label="Командная палитра" onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
        }}>
            <div className="ui-command">
                <div className="ui-command__search">
                    <Icon name="search" size={19} className="text-white/40 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Куда перейти или что открыть?"
                        aria-label="Поиск по командам"
                    />
                    <kbd className="ui-command__shortcut">ESC</kbd>
                </div>

                <div className="ui-command__list">
                    <div className="ui-command__group">{query ? 'Результаты' : 'Быстрый доступ'}</div>
                    {filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/35">
                            Ничего не найдено
                        </div>
                    ) : (
                        filtered.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`ui-command__item ${index === selected ? 'is-selected' : ''}`}
                                onMouseEnter={() => setSelected(index)}
                                onClick={() => {
                                    navigate(item.to);
                                    close();
                                }}
                            >
                                <span className="ui-command__item-icon"><Icon name={item.icon} size={17} /></span>
                                <span className="ui-command__item-copy">
                                    <span className="ui-command__item-title">{item.title}</span>
                                    <span className="ui-command__item-sub">{item.sub}</span>
                                </span>
                                {location.pathname === item.to && <Icon name="check" size={16} className="text-violet-soft" />}
                            </button>
                        ))
                    )}
                </div>

                <div className="px-4 py-3 border-t border-white/5 text-[10px] text-white/30 flex items-center gap-3">
                    <span>↑↓ навигация</span>
                    <span>Enter открыть</span>
                    <span>Esc закрыть</span>
                </div>
            </div>
        </div>
    );
}
