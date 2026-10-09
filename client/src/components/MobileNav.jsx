import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

export default function MobileNav({ links, user }) {
    const location = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);
    const [typing, setTyping] = useState(false);
    const blurFrame = useRef(null);
    useEffect(() => {
        const isEditor = (node) => node instanceof HTMLElement && (node.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"]') || Boolean(node.closest('[contenteditable="true"]')));
        const onFocusIn = (event) => {
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
            blurFrame.current = null;
            if (isEditor(event.target)) { setTyping(true); setMoreOpen(false); }
        };
        const onFocusOut = () => {
            // Allow focus to move between inputs without flashing the navigation.
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
            blurFrame.current = requestAnimationFrame(() => {
                blurFrame.current = null;
                setTyping(isEditor(document.activeElement));
            });
        };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        setTyping(isEditor(document.activeElement));
        return () => {
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
        };
    }, []);

    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);
    if (isChatRoom || typing) return null;

    const primary = [
        { to: '/app', label: 'Главная', icon: 'dashboard', end: true },
        { to: '/app/feed', label: 'Лента', icon: 'feed' },
        { to: `/app/u/${user.username}`, label: 'Профиль', icon: 'user' },
        { to: '/app/chats', label: 'Чаты', icon: 'message' },
        { action: 'more', label: 'Ещё', icon: 'more' },
    ];

    const extra = [
        { to: '/app/courses', label: 'Обучение', icon: 'book' },
        { to: '/app/wiki', label: 'Wiki', icon: 'book' },
        { to: '/app/leaderboard', label: 'Рейтинг', icon: 'trophy' },
        { to: '/app/notifications', label: 'Уведомления', icon: 'bell' },
        ...(user?.role === 'MENTOR' || user?.role === 'ADMIN'
            ? [{ to: '/app/mentor', label: 'Руководителю', icon: 'users' }]
            : []),
        ...(user?.role === 'ADMIN'
            ? [{ to: '/app/admin', label: 'Админка', icon: 'settings' }]
            : []),
    ];

    return (
        <>
            <nav className="ui-mobile-nav md:hidden" aria-label="Основная навигация">
                {primary.map((item) => {
                    if (item.action === 'more') {
                        return (
                            <button
                                key="more"
                                type="button"
                                className="ui-mobile-nav__item"
                                onClick={() => setMoreOpen(true)}
                            >
                                <span className="ui-mobile-nav__icon"><Icon name="more" size={21} /></span>
                                <span>{item.label}</span>
                            </button>
                        );
                    }
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `ui-mobile-nav__item ${isActive ? 'is-active' : ''}`}
                        >
                            <span className="ui-mobile-nav__icon"><Icon name={item.icon} size={20} /></span>
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {moreOpen && (
                <div className="ui-more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
                    <div className="ui-more-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="ui-more-sheet__handle" />
                        <div className="ui-more-grid">
                            {extra.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMoreOpen(false)}
                                    className="ui-more-item"
                                >
                                    <Icon name={item.icon} size={22} />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
