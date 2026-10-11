import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { useSettings } from '../store/settings.jsx';

export default function MobileNav({ links, user }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { raw: siteSettings } = useSettings();
    const [standalone, setStandalone] = useState(() => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true));
    useEffect(() => { const media = window.matchMedia('(display-mode: standalone)'); const refresh = () => setStandalone(media.matches || window.navigator.standalone === true); media.addEventListener?.('change', refresh); return () => media.removeEventListener?.('change', refresh); }, []);
    const [moreOpen, setMoreOpen] = useState(false);
    const [typing, setTyping] = useState(false);
    const [searchActive, setSearchActive] = useState(false);
    const blurFrame = useRef(null);
    useEffect(() => {
        const isEditor = (node) => node instanceof HTMLElement && (node.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"]') || Boolean(node.closest('[contenteditable="true"]')));
        const onFocusIn = (event) => {
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
            blurFrame.current = null;
            if (isEditor(event.target)) { setTyping(true); setMoreOpen(false); }
        };
        const onSearchOpen = () => setSearchActive(true);
        const onSearchClose = () => {
            setSearchActive(false);
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
            blurFrame.current = requestAnimationFrame(() => {
                blurFrame.current = null;
                setTyping(isEditor(document.activeElement));
            });
        };
        window.addEventListener('mrr:search-open', onSearchOpen);
        window.addEventListener('mrr:search-close', onSearchClose);
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
            window.removeEventListener('mrr:search-open', onSearchOpen);
            window.removeEventListener('mrr:search-close', onSearchClose);
            if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current);
        };
    }, []);

    useEffect(() => {
        // Route transitions can unmount a focused search input without firing focusout.
        const frame = requestAnimationFrame(() => {
            const node = document.activeElement;
            setTyping(node instanceof HTMLElement && (node.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"]') || Boolean(node.closest('[contenteditable="true"]'))));
        });
        return () => cancelAnimationFrame(frame);
    }, [location.pathname]);

    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);
    if (isChatRoom || typing || searchActive) return null;

    const handleLogout = () => {
        if (!window.confirm('Выйти из аккаунта?')) return;
        setMoreOpen(false);
        logout();
        navigate('/login', { replace: true });
    };

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

    const parseMenu = (value, fallback) => { try { const v = JSON.parse(value || 'null'); return Array.isArray(v) ? v : fallback; } catch { return fallback; } };
    const navKey = standalone ? 'nav_pwa_items' : 'nav_mobile_items';
    const moreKey = standalone ? 'nav_pwa_more_items' : 'nav_mobile_more_items';
    const resolve = (item) => ({ ...item, to: item.to === '/app/u/me' ? `/app/u/${user.username}` : item.to });
    const allowed = (item) => !item.roles || item.roles.includes(user?.role);
    const primaryItems = parseMenu(siteSettings[navKey], primary).filter(allowed).map(resolve).slice(0, 5);
    const extraItems = parseMenu(siteSettings[moreKey], extra).filter(allowed).filter(item => item.action !== 'more').map(resolve);
    return (
        <>
            <nav className="ui-mobile-nav md:hidden" aria-label="Основная навигация">
                {primaryItems.map((item) => {
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
                            {extraItems.map((item) => (
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
                        <div className="mt-3 border-t border-white/10 pt-3">
                            <button
                                type="button"
                                className="ui-mobile-logout flex min-h-12 w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold"
                                onClick={handleLogout}
                                aria-label="Выйти из аккаунта"
                            >
                                <Icon name="logOut" size={20} />
                                <span>Выйти из аккаунта</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
