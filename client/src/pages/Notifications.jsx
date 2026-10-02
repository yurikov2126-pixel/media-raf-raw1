import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../store/notifications.jsx';

const ICONS = {
    message: '💬', mention: '📣', post: '📝', certificate: '🏆', system: '📢',
};

const TITLES = {
    message: (p) => `Новое сообщение от ${p.senderName || 'пользователя'}`,
    mention: (p) => `${p.senderName || 'Кто-то'} упомянул вас`,
    post: (p) => `Новый пост от ${p.authorName || 'автора'}`,
    certificate: (p) => p.title || 'Получен сертификат',
    system: (p) => p.title || 'Сообщение от администрации',
};

const FILTERS = [
    { v: 'all', l: 'Все' },
    { v: 'unread', l: 'Непрочитанные' },
    { v: 'message', l: '💬 Сообщения' },
    { v: 'post', l: '📝 Посты' },
    { v: 'certificate', l: '🏆 Сертификаты' },
    { v: 'system', l: '📢 Система' },
];

export default function Notifications() {
    const { items, unread, markAllRead, markRead, remove, reload } = useNotifications();
    const [filter, setFilter] = useState('all');
    const nav = useNavigate();

    useEffect(() => { reload(); }, [reload]);

    const filtered = useMemo(() => {
        if (filter === 'all') return items;
        if (filter === 'unread') return items.filter((n) => !n.readAt);
        return items.filter((n) => n.type === filter);
    }, [items, filter]);

    const go = async (n) => {
        if (!n.readAt) await markRead(n.id);
        const p = n.payload || {};
        if (n.type === 'message' || n.type === 'mention') nav(`/app/chats/${p.chatId}`);
        else if (n.type === 'post') nav(`/app/u/${p.authorUsername}`);
        else if (n.type === 'certificate') nav(`/app/certificates/${p.certificateId}`);
    };

    return (
        <div className="max-w-3xl mx-auto p-5 md:p-8">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold">Уведомления</h1>
                    {unread > 0 && (
                        <div className="text-white/40 text-sm mt-1">
                            Непрочитанных: <span className="text-pink font-semibold">{unread}</span>
                        </div>
                    )}
                </div>
                {unread > 0 && (
                    <button onClick={markAllRead} className="btn-ghost !py-2 text-sm">
                        Прочитать все
                    </button>
                )}
            </div>

            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.v}
                        onClick={() => setFilter(f.v)}
                        className={`chip shrink-0 ${filter === f.v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                    >{f.l}</button>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    {filter === 'unread' ? 'Нет непрочитанных' : 'Пока ничего нет'}
                </div>
            )}

            <div className="card p-0 overflow-hidden">
                {filtered.map((n) => (
                    <div
                        key={n.id}
                        className={`group px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer flex gap-3 ${
                            !n.readAt ? 'bg-violet/5' : ''
                        }`}
                        onClick={() => go(n)}
                    >
                        <div className="text-2xl shrink-0">{ICONS[n.type] || '🔔'}</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">
                                {(TITLES[n.type] || TITLES.system)(n.payload || {})}
                            </div>
                            {(n.type === 'message' || n.type === 'mention') && (
                                <div className="text-xs text-white/50 truncate mt-0.5">
                                    {n.payload.chatTitle && <span className="text-white/70">{n.payload.chatTitle}: </span>}
                                    {n.payload.preview}
                                </div>
                            )}
                            {n.type === 'post' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">{n.payload.preview}</div>
                            )}
                            {n.type === 'certificate' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">{n.payload.courseTitle}</div>
                            )}
                            {n.type === 'system' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">{n.payload.message}</div>
                            )}
                            <div className="text-[10px] text-white/30 mt-1">
                                {new Date(n.createdAt).toLocaleString('ru-RU')}
                            </div>
                        </div>
                        {!n.readAt && <div className="w-2 h-2 rounded-full bg-pink shrink-0 mt-2" />}
                        <button
                            onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                            className="opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-pink text-sm shrink-0"
                            title="Удалить"
                        >✕</button>
                    </div>
                ))}
            </div>
        </div>
    );
}