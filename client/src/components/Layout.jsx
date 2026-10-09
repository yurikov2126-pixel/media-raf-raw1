import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation, useOutlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useSettings } from '../store/settings.jsx';
import { useModules, moduleKeyForPath } from '../store/modules.jsx';
import { useGamification } from '../store/gamification.jsx';
import { isAnyModalOpen, subscribeModalState } from '../lib/modalStack.js';
import MobileNav from './MobileNav.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Icon from './Icon.jsx';

const FALLBACK_LINKS = [
    { to: '/app', label: 'Главная', end: true, icon: 'dashboard' },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'book' },
];

const MODULE_ORDER = ['feed', 'chats', 'courses', 'wiki'];

function normalizeLinks(items) {
    const legacy = { '🏠': 'dashboard', '💬': 'message', '🎓': 'book', '📖': 'book', '🏆': 'trophy', '⚙️': 'settings' };
    return items.map((item) => ({
        ...item,
        icon: legacy[item.icon] || (typeof item.icon === 'string' && item.icon.length <= 24 ? item.icon : 'sparkles'),
    }));
}

export default function Layout() {
    const { user, logout } = useAuth();
    const { brand, nav, commandPalette } = useSettings();
    const { modules, isEnabled } = useModules();
    const { enabled: gamifEnabled } = useGamification();
    const navigate = useNavigate();
    const location = useLocation();
    const outlet = useOutlet();
    const [modalOpen, setModalOpen] = useState(() => isAnyModalOpen());

    useEffect(() => subscribeModalState(setModalOpen), []);

    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);
    const isAdmin = user?.role === 'ADMIN';
    const isMentor = user?.role === 'MENTOR' || user?.role === 'ADMIN';

    const rawLinks = nav.items.length > 0 ? nav.items : FALLBACK_LINKS;
    const links = normalizeLinks(rawLinks).filter((l) => {
        const key = moduleKeyForPath(l.to);
        return !key || isEnabled(key);
    });
    const SWIPE_ORDER = links.map((l) => l.to);

    useEffect(() => {
        if (Object.keys(modules).length === 0) return;
        const currentKey = moduleKeyForPath(location.pathname);
        if (!currentKey) return;
        if (isEnabled(currentKey)) return;
        const target = MODULE_ORDER.find((k) => isEnabled(k));
        if (target === 'feed') navigate('/app/feed', { replace: true });
        else if (target) navigate(`/app/${target}`, { replace: true });
    }, [location.pathname, modules, isEnabled, navigate]);

    const handlePanEnd = (_e, info) => {
        if (modalOpen || info.pointerType !== 'touch') return;
        if (window.matchMedia('(min-width: 768px)').matches) return;
        const dx = info.offset.x;
        const dy = info.offset.y;
        if (Math.abs(dy) > Math.abs(dx)) return;
        const i = SWIPE_ORDER.findIndex((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
        if (i < 0) return;
        if (dx < -80 && i < SWIPE_ORDER.length - 1) navigate(SWIPE_ORDER[i + 1]);
        else if (dx > 80 && i > 0) navigate(SWIPE_ORDER[i - 1]);
    };

    const openCommand = () => window.dispatchEvent(new Event('mrr:command-open'));

    return (
        <div className="min-h-screen flex ui-shell">
            <aside className="ui-sidebar flex-col">
                <div className="ui-brand">
                    <div className="ui-brand__mark"><Icon name="sparkles" size={20} /></div>
                    <div className="min-w-0">
                        <div className="ui-brand__name bg-clip-text text-transparent" style={{ backgroundImage: 'var(--brand-gradient)' }}>
                            {brand.logoText}
                        </div>
                        <div className="ui-brand__sub">{brand.logoSubtitle}</div>
                    </div>
                </div>

                <nav className="ui-nav" aria-label="Основная навигация">
                    {links.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            end={l.end}
                            className={({ isActive }) => `ui-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="ui-nav-item__icon"><Icon name={l.icon} size={19} /></span>
                            <span className="ui-nav-item__label">{l.label}</span>
                        </NavLink>
                    ))}
                    {gamifEnabled && (
                        <NavLink to="/app/leaderboard" className={({ isActive }) => `ui-nav-item ${isActive ? 'active' : ''}`}>
                            <span className="ui-nav-item__icon"><Icon name="trophy" size={19} /></span>
                            <span className="ui-nav-item__label">Рейтинг</span>
                        </NavLink>
                    )}
                    {isMentor && (
                        <NavLink to="/app/mentor" className={({ isActive }) => `ui-nav-item ${isActive ? 'active' : ''}`}>
                            <span className="ui-nav-item__icon"><Icon name="users" size={19} /></span>
                            <span className="ui-nav-item__label">Руководителю</span>
                        </NavLink>
                    )}
                    {isAdmin && (
                        <NavLink to="/app/admin" className={({ isActive }) => `ui-nav-item ${isActive ? 'active' : ''}`}>
                            <span className="ui-nav-item__icon"><Icon name="settings" size={19} /></span>
                            <span className="ui-nav-item__label">Админка</span>
                        </NavLink>
                    )}
                </nav>

                <div className="mt-auto">
                    {commandPalette.enabled && (
                        <button type="button" className="ui-command-trigger w-full mb-2" onClick={openCommand}>
                            <Icon name="search" size={16} />
                            <span className="flex-1 text-left">Поиск и переход</span>
                            <kbd>{commandPalette.shortcutLabel}</kbd>
                        </button>
                    )}

                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                            <NotificationBell align="left" />
                            <ThemeToggle />
                        </div>
                        <button onClick={logout} className="ui-icon-button !w-10 !h-10" title="Выйти" aria-label="Выйти">
                            <Icon name="logOut" size={17} />
                        </button>
                    </div>

                    <button onClick={() => navigate(`/app/u/${user.username}`)} className="ui-user">
                        <Avatar user={user} size={38} />
                        <span className="ui-user__meta">
                            <span className="ui-user__name">{user.fullName}</span>
                            <span className="ui-user__handle">@{user.username}</span>
                        </span>
                        <Icon name="chevronRight" size={16} className="text-white/25" />
                    </button>
                </div>
            </aside>

            <motion.main onPanEnd={handlePanEnd} className="ui-main min-w-0 pb-24 md:pb-0 safe-top">
                {!isChatRoom && (
                    <div className="ui-mobile-topbar">
                        <button type="button" className="ui-mobile-topbar__brand" onClick={() => navigate('/app')}>
                            {brand.logoText}
                        </button>
                        <div className="flex items-center gap-1">
                            {commandPalette.enabled && (
                                <button className="ui-icon-button" onClick={openCommand} title="Поиск" aria-label="Поиск">
                                    <Icon name="search" size={18} />
                                </button>
                            )}
                            <ThemeToggle />
                            {isMentor && !isAdmin && <Link to="/app/mentor" className="ui-icon-button" title="Руководителю"><Icon name="users" size={18} /></Link>}
                            {isAdmin && <Link to="/app/admin" className="ui-icon-button" title="Админка"><Icon name="settings" size={18} /></Link>}
                            <NotificationBell align="right" />
                        </div>
                    </div>
                )}

                <div key={location.pathname} className="page-enter">{outlet}{!isChatRoom && <div className="ui-mobile-content-clearance" aria-hidden="true" />}</div>
            </motion.main>

            <MobileNav links={links} user={user} />
        </div>
    );
}
