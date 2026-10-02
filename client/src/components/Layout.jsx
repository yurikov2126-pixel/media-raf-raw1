import { NavLink, useNavigate, useLocation, useOutlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useSettings } from '../store/settings.jsx';
import MobileNav from './MobileNav.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';
import NetworkBanner from './NetworkBanner.jsx';

const FALLBACK_LINKS = [
    { to: '/app', label: 'Лента', end: true, icon: '🏠' },
    { to: '/app/chats', label: 'Чаты', icon: '💬' },
    { to: '/app/courses', label: 'Обучение', icon: '🎓' },
    { to: '/app/wiki', label: 'Вики', icon: '📖' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const { brand, nav } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const outlet = useOutlet();

    /*
     * isChatRoom === true ТОЛЬКО для конкретного чата /app/chats/<id>.
     * Для списка /app/chats — false, и он ведёт себя как обычная
     * страница: сверху мобильный хедер, снизу MobileNav.
     *
     * Регэксп: "/app/chats/" + хотя бы один непустой сегмент.
     */
    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);

    const links = nav.items.length > 0 ? nav.items : FALLBACK_LINKS;
    const SWIPE_ORDER = links.map((l) => l.to);
    const isAdmin = user?.role === 'ADMIN';

    const handlePanEnd = (_e, info) => {
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
                        <NotificationBell align="left" />
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

            {/*
              motion.main — простой flex-item без flex-col.
              Для открытого чата main фактически перекрыт overlay'ем
              Messenger'а (fixed inset-0), но сам Layout продолжает
              рендериться под ним, чтобы сайдбар на ПК оставался виден.
            */}
            <motion.main
                onPanEnd={handlePanEnd}
                className="flex-1 min-w-0 pb-20 md:pb-0 safe-top"
            >
                {/*
                  Мобильный хедер рендерится на всех страницах,
                  КРОМЕ открытого чата — там его перекрывает Messenger.
                */}
                {!isChatRoom && (
                    <div className="md:hidden sticky top-0 z-30 bg-ink-800/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 py-2">
                        <div
                            className="text-lg font-bold bg-clip-text text-transparent"
                            style={{ backgroundImage: 'var(--brand-gradient)' }}
                        >
                            {brand.logoText}
                        </div>

                        <div className="flex items-center gap-1">
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

                {/*
                  page-enter с transform — только для обычных страниц.
                  Для открытого чата используем page-enter-fade (без
                  transform) — иначе transform создаёт containing block
                  и fixed-overlay Messenger'а позиционируется относительно
                  этой обёртки, а не viewport'а.
                */}
                <div
                    key={location.pathname}
                    className={isChatRoom ? 'page-enter-fade' : 'page-enter'}
                >
                    {outlet}
                </div>
            </motion.main>

            <MobileNav links={links} user={user} />
        </div>
    );
}