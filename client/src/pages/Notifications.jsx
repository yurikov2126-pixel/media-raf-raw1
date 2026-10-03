import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../store/notifications.jsx';
import ConfirmDialog from './Admin/components/ConfirmDialog.jsx';

const ICONS = {
    message: '💬',
    mention: '📣',
    post: '📝',
    certificate: '🏆',
    system: '📢',
    report: '🚩',
};

const TITLES = {
    message: (p) => `Новое сообщение от ${p.senderName || 'пользователя'}`,
    mention: (p) => `${p.senderName || 'Кто-то'} упомянул вас`,
    post: (p) => `Новый пост от ${p.authorName || 'автора'}`,
    certificate: (p) => p.title || 'Получен сертификат',
    system: (p) => p.title || 'Сообщение от администрации',
    report: (p) =>
        `Жалоба на ${p.targetLabel || 'контент'} от ${p.reporterName || 'пользователя'}`,
};

const FILTERS = [
    { v: 'all', l: 'Все' },
    { v: 'unread', l: 'Непрочитанные' },
    { v: 'report', l: '🚩 Жалобы' },
    { v: 'message', l: '💬 Сообщения' },
    { v: 'post', l: '📝 Посты' },
    { v: 'certificate', l: '🏆 Сертификаты' },
    { v: 'system', l: '📢 Система' },
];

export default function Notifications() {
    const {
        items, unread, readCount, total,
        markAllRead, markRead, remove,
        removeRead, removeAll, reload,
    } = useNotifications();
    const [filter, setFilter] = useState('all');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null); // 'clearRead' | 'clearAll'
    const [message, setMessage] = useState('');
    const nav = useNavigate();

    useEffect(() => {
        reload();
    }, [reload]);

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
        else if (n.type === 'report') nav('/app/admin?tab=moderation');
    };

    const flash = (text) => {
        setMessage(text);
        setTimeout(() => setMessage(''), 2500);
    };

    const doClear = async () => {
        setBusy(true);
        try {
            if (confirm === 'clearRead') {
                const n = await removeRead();
                flash(n > 0 ? `Удалено прочитанных: ${n}` : 'Прочитанных нет');
            } else if (confirm === 'clearAll') {
                const n = await removeAll();
                flash(n > 0 ? `Удалено всего: ${n}` : 'Нечего удалять');
            }
        } catch (e) {
            flash('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-5 md:p-8">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold">Уведомления</h1>
                    <div className="text-white/40 text-sm mt-1">
                        Всего: {total}
                        {unread > 0 && (
                            <>
                                {' · '}
                                <span className="text-pink font-semibold">
                                    непрочитанных: {unread}
                                </span>
                            </>
                        )}
                        {readCount > 0 && (
                            <>
                                {' · '}
                                <span>прочитанных: {readCount}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {unread > 0 && (
                        <button
                            onClick={markAllRead}
                            disabled={busy}
                            className="btn-ghost !py-2 text-sm"
                            title="Пометить все как прочитанные"
                        >
                            ✓ Прочитать все
                        </button>
                    )}
                    {readCount > 0 && (
                        <button
                            onClick={() => setConfirm('clearRead')}
                            disabled={busy}
                            className="btn-ghost !py-2 text-sm"
                            title="Удалить только прочитанные"
                        >
                            🧹 Очистить прочитанные
                        </button>
                    )}
                    {total > 0 && (
                        <button
                            onClick={() => setConfirm('clearAll')}
                            disabled={busy}
                            className="btn-ghost !py-2 text-sm text-pink"
                            title="Удалить все уведомления"
                        >
                            🗑️ Очистить всё
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className="mb-5 text-sm bg-lime/10 border border-lime/30 text-lime rounded-xl p-3">
                    {message}
                </div>
            )}

            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
                {FILTERS.map((f) => {
                    const count =
                        f.v === 'all'
                            ? total
                            : f.v === 'unread'
                                ? unread
                                : items.filter((n) => n.type === f.v).length;
                    return (
                        <button
                            key={f.v}
                            onClick={() => setFilter(f.v)}
                            className={`chip shrink-0 ${
                                filter === f.v
                                    ? 'bg-violet text-white'
                                    : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {f.l}
                            {count > 0 && (
                                <span className="ml-1 opacity-70">({count})</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    {filter === 'unread'
                        ? 'Нет непрочитанных'
                        : filter === 'all'
                            ? 'Уведомлений нет'
                            : 'В этой категории пусто'}
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
                                    {n.payload.chatTitle && (
                                        <span className="text-white/70">
                                            {n.payload.chatTitle}:{' '}
                                        </span>
                                    )}
                                    {n.payload.preview}
                                </div>
                            )}
                            {n.type === 'post' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">
                                    {n.payload.preview}
                                </div>
                            )}
                            {n.type === 'certificate' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">
                                    {n.payload.courseTitle}
                                </div>
                            )}
                            {n.type === 'system' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">
                                    {n.payload.message}
                                </div>
                            )}
                            {n.type === 'report' && (
                                <div className="text-xs text-white/50 truncate mt-0.5">
                                    Причина: {n.payload.reason}
                                    {n.payload.autoAction && (
                                        <span className="ml-2 text-pink">
                                            · авто: {n.payload.autoAction}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="text-[10px] text-white/30 mt-1">
                                {new Date(n.createdAt).toLocaleString('ru-RU')}
                            </div>
                        </div>
                        {!n.readAt && (
                            <div className="w-2 h-2 rounded-full bg-pink shrink-0 mt-2" />
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                remove(n.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-pink text-sm shrink-0"
                            title="Удалить"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <ConfirmDialog
                open={!!confirm}
                title={
                    confirm === 'clearAll'
                        ? 'Очистить все уведомления?'
                        : 'Очистить прочитанные?'
                }
                description={
                    confirm === 'clearAll'
                        ? `Будут удалены все ${total} уведомлений, включая непрочитанные (${unread}). Действие необратимо.`
                        : `Будут удалены ${readCount} прочитанных уведомлений. Непрочитанные останутся.`
                }
                confirmLabel="Удалить"
                danger={confirm === 'clearAll'}
                busy={busy}
                onConfirm={doClear}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}