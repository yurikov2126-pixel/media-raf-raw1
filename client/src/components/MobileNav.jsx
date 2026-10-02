import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import Avatar from './Avatar.jsx';

export default function MobileNav({ links, user }) {
    const nav = useNavigate();
    const location = useLocation();

    /*
     * Нижняя панель скрывается ТОЛЬКО в открытом чате
     * (/app/chats/<id>) — там она перекрывается Messenger'ом.
     *
     * В списке чатов (/app/chats без id) панель показывается —
     * как на любой другой странице платформы.
     */
    const isChatRoom = /^\/app\/chats\/.+/.test(location.pathname);
    if (isChatRoom) return null;

    return (
        <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-800/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around py-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
            {links.map((l) => (
                <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                        `flex flex-col items-center px-4 py-1 rounded-xl ${
                            isActive ? 'text-white' : 'text-white/50'
                        }`
                    }
                >
                    <span className="text-xl">{l.icon}</span>
                    <span className="text-[10px] font-semibold">{l.label}</span>
                </NavLink>
            ))}
            <button
                onClick={() => nav(`/app/u/${user.username}`)}
                className="flex flex-col items-center px-4 py-1 text-white/50"
            >
                <Avatar user={user} size={22} />
                <span className="text-[10px] font-semibold">Профиль</span>
            </button>
        </nav>
    );
}