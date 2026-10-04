import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import Avatar from '../components/Avatar.jsx';
import LevelBadge from '../components/LevelBadge.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

const DIR_LABEL = { photo: '📸', video: '🎥', radio: '📻', sound: '🎚️' };

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
    const { token, user } = useAuth();
    const [period, setPeriod] = useState('all');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    usePageMeta({
        title: 'Рейтинг',
        description: 'Топ студентов медиацентра по очкам опыта',
    });

    useEffect(() => {
        setLoading(true);
        api(`/gamification/leaderboard?period=${period}&limit=100`, { token })
            .then((r) => setItems(r.items || []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [period, token]);

    const myRank = items.findIndex((it) => it.user.id === user.id) + 1;

    return (
        <div className="p-5 md:p-10 max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-bold flex items-center gap-3">
                        🏆 Рейтинг
                    </h1>
                    <p className="text-white/50 mt-1">
                        Топ студентов медиацентра
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => setPeriod('week')}
                        className={`chip ${
                            period === 'week'
                                ? 'bg-violet text-white'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        За неделю
                    </button>
                    <button
                        onClick={() => setPeriod('all')}
                        className={`chip ${
                            period === 'all'
                                ? 'bg-violet text-white'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        За всё время
                    </button>
                </div>
            </div>

            {myRank > 0 && (
                <div
                    className="card p-4 mb-6 flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, #7C3AED15 0%, #EC489915 100%)' }}
                >
                    <div className="text-2xl font-bold text-violet-soft w-10 text-center">
                        {myRank}
                    </div>
                    <Avatar user={user} size={40} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{user.fullName}</div>
                            <LevelBadge />
                        </div>
                        <div className="text-xs text-white/40">Ваша позиция</div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-lg tabular-nums">
                            {items[myRank - 1].value.toLocaleString('ru-RU')}
                        </div>
                        <div className="text-[10px] text-white/40 uppercase">
                            {period === 'week' ? 'XP за неделю' : 'XP всего'}
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="card p-10 text-center text-white/40">Загрузка…</div>
            )}

            {!loading && items.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    Пока никто не набрал очков. Станьте первым!
                </div>
            )}

            <div className="card divide-y divide-white/5">
                {items.map((item) => {
                    const isMe = item.user.id === user.id;
                    const medal = item.rank <= 3 ? MEDALS[item.rank - 1] : null;
                    return (
                        <Link
                            key={item.user.id}
                            to={`/app/u/${item.user.username}`}
                            className={`flex items-center gap-3 p-4 hover:bg-white/5 transition ${
                                isMe ? 'bg-violet/10' : ''
                            }`}
                        >
                            <div
                                className={`w-10 text-center shrink-0 ${
                                    medal ? 'text-2xl' : 'text-sm font-bold text-white/40'
                                }`}
                            >
                                {medal || item.rank}
                            </div>
                            <Avatar user={item.user} size={40} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-semibold truncate">
                                        {item.user.fullName}
                                    </div>
                                    <LevelBadge />
                                    {isMe && (
                                        <span className="chip bg-violet/20 text-violet-soft text-[10px]">
                                            вы
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-white/40 truncate">
                                    @{item.user.username}
                                    {item.user.direction && ` · ${DIR_LABEL[item.user.direction] || ''}`}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-bold text-lg tabular-nums">
                                    {item.value.toLocaleString('ru-RU')}
                                </div>
                                <div className="text-[10px] text-white/40 uppercase">XP</div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}