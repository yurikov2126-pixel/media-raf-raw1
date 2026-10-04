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
import NetworkBanner from './NetworkBanner.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const FALLBACK_LINKS = [
    { to: '/app', label: 'Лента', end: true, icon: '🏠' },
    { to: '/app/chats', label: 'Чаты', icon: '💬' },
    { to: '/app/courses', label: 'Обучение', icon: '🎓' },
    { to: '/app/wiki', label: 'Вики', icon: '📖' },
];

const MODULE_ORDER = ['feed', 'chats', 'courses', 'wiki'];

export default function Layout() {
    const { user, logout } = useAuth();
    const { brand, nav } = useSettings();
    const { modules, isEnabled } = useModules();
    const { enabled: gamifEnabled } = useGamification();
    const navigate = useNavigate();
    const location = useLocation();
    const outlet = useOutlet();

    const [modalOpen, setModalOpen] = useState(() => isAnyModalOpen());

    useEffect(() => {
        return subscribeModalState(setModalOpen);
    }, []);

    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);
    const isAdmin = user?.role === 'ADMIN';

    const rawLinks = nav.items.length > 0 ? nav.items : FALLBACK_LINKS;
    const links = rawLinks.filter((l) => {
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
        if (target === 'feed') navigate('/app', { replace: true });
        else if (target) navigate(`/app/${target}`, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, modules]);

    const handlePanEnd = (_e, info) => {
        // Не свайпаем, когда открыта любая модалка
        if (modalOpen) return;

        if (info.pointerType !== 'touch') return;
        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(min-width: 768px)').matches
        ) {
            return;
        }

        const dx = info.offset.x;
        const dy = info.offset.y;
        if (Math.abs(dy) > Math.abs(dx)) return;

        const i = SWIPE_ORDER.findIndex(
            (p) => location.pathname === p || location.pathname.startsWith(p + '/')
        );
        if (i < 0) return;

        if (dx < -80 && i < SWIPE_ORDER.length - 1) navigate(SWIPE_ORDER[i + 1]);
        else if (dx > 80 && i > 0) navigate(SWIPE_ORDER[i - 1]);
    };

    return (
        <div className="min-h-screen flex">
            {/* Сайдбар — ПК */}
            <aside className="hidden md:flex flex-col w-64 p-5 gap-2 border-r border-white/5 sticky top-0 h-screen">
                <div className="mb-4">
                    <div
                        className="text-2xl font-bold bg-clip-text text-transparent"
                        style={{ backgroundImage: 'var(--brand-gradient)' }}
                    >
                        {brand.logoText}
                    </div>
                    <div className="text-xs text-white/40 mt-1">{brand.logoSubtitle}</div>
                </div>

                {links.map((l) => (
                    <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.end}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                            }`
                        }
                    >
                        <span className="text-xl">{l.icon}</span>
                        <span className="font-semibold">{l.label}</span>
                    </NavLink>
                ))}

                {gamifEnabled && (
                    <NavLink
                        to="/app/leaderboard"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                            }`
                        }
                    >
                        <span className="text-xl">🏆</span>
                        <span className="font-semibold">Рейтинг</span>
                    </NavLink>
                )}

                {isAdmin && (
                    <NavLink
                        to="/app/admin"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                            }`
                        }
                    >
                        <span className="text-xl">⚙️</span>
                        <span className="font-semibold">Админка</span>
                    </NavLink>
                )}

                <div className="mt-auto min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                            <NotificationBell align="left" />
                            <ThemeToggle />
                        </div>
                        <button
                            onClick={logout}
                            className="text-xs text-white/40 hover:text-pink px-3"
                        >
                            Выйти
                        </button>
                    </div>
                    <button
                        onClick={() => navigate(`/app/u/${user.username}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 min-w-0"
                    >
                        <div className="shrink-0">
                            <Avatar user={user} size={40} />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{user.fullName}</div>
                            <div className="text-xs text-white/40 truncate">@{user.username}</div>
                        </div>
                    </button>
                </div>
            </aside>

            <motion.main
                onPanEnd={handlePanEnd}
                className="flex-1 min-w-0 pb-20 md:pb-0 safe-top"
            >
                {!isChatRoom && (
                    <div className="md:hidden sticky top-0 z-30 bg-ink-800/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 py-2">
                        <div
                            className="text-lg font-bold bg-clip-text text-transparent"
                            style={{ backgroundImage: 'var(--brand-gradient)' }}
                        >
                            {brand.logoText}
                        </div>

                        <div className="flex items-center gap-1">
                            <ThemeToggle />
                            {isAdmin && (
                                <Link
                                    to="/app/admin"
                                    className="w-9 h-9 grid place-items-center rounded-full text-lg text-white/70 hover:text-white hover:bg-white/10 transition"
                                    title="Админ-панель"
                                    aria-label="Админ-панель"
                                >
                                    ⚙️
                                </Link>
                            )}
                            <NotificationBell align="right" />
                        </div>
                    </div>
                )}

                <NetworkBanner />

                <div key={location.pathname} className="page-enter">
                    {outlet}
                </div>
            </motion.main>

            <MobileNav links={links} user={user} />
        </div>
    );
}