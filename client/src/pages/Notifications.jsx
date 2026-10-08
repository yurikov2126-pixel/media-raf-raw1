import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../store/notifications.jsx';
import ConfirmDialog from './Admin/components/ConfirmDialog.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

const ICONS = {
    message: '💬',
    mention: '📣',
    post: '📝',
    certificate: '🏆',
    system: '📢',
    report: '🚩',
    password_reset: '🔑',
    lesson_new: '📖',
    practical_scheduled: '🎯',
    practical_due: '⏰',
    homework_due: '📋',
    lesson_unlocked: '🔓',
    homework_overdue: '⚠️',
};

const TITLES = {
    message: (p) => `Новое сообщение от ${p.senderName || 'пользователя'}`,
    mention: (p) => `${p.senderName || 'Кто-то'} упомянул вас`,
    post: (p) => `Новый пост от ${p.authorName || 'автора'}`,
    certificate: (p) => p.title || 'Получен сертификат',
    system: (p) => p.title || 'Сообщение от администрации',
    report: (p) =>
        `Жалоба на ${p.targetLabel || 'контент'} от ${p.reporterName || 'пользователя'}`,
    password_reset: (p) =>
        `Запрос на сброс пароля от ${p.userName || 'пользователя'}`,
    lesson_new: (p) => `📖 Новый урок: ${p.lessonTitle || ''}`,
    practical_scheduled: (p) => `🎯 Практика: ${p.topic || ''}`,
    practical_due: (p) => `⏰ Скоро практика: ${p.topic || ''}`,
    homework_due: (p) => `📋 Скоро дедлайн ДЗ: ${p.title || ''}`,
    lesson_unlocked: (p) => `🔓 Открыт урок: ${p.lessonTitle || ''}`,
    homework_overdue: (p) => `⚠️ Просрочено ДЗ: ${p.title || ''}`,
};

const FILTERS = [
    { v: 'all', l: 'Все' },
    { v: 'unread', l: 'Непрочитанные' },
    { v: 'lesson_new', l: '📖 Уроки' },
    { v: 'practical_scheduled', l: '🎯 Практики' },
    { v: 'practical_due', l: '⏰ Напоминания' },
    { v: 'homework_due', l: '📋 ДЗ' },
    { v: 'report', l: '🚩 Жалобы' },
    { v: 'message', l: '💬 Сообщения' },
    { v: 'post', l: '📝 Посты' },
    { v: 'certificate', l: '🏆 Сертификаты' },
    { v: 'system', l: '📢 Система' },
    { v: 'password_reset', l: '🔑 Пароли' },
    { v: 'lesson_unlocked', l: '🔓 Открытие уроков' },
    { v: 'homework_overdue', l: '⚠️ Просроченные' },

];

export default function Notifications() {
    const {
        items, unread, readCount, total,
        markAllRead, markRead, remove,
        removeRead, removeAll, reload,
    } = useNotifications();
    const [filter, setFilter] = useState('all');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);
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
        else if (n.type === 'password_reset') nav('/app/admin?tab=password-resets');
        else if (
            n.type === 'lesson_new' ||
            n.type === 'lesson_unlocked' ||
            n.type === 'practical_scheduled' ||
            n.type === 'practical_due' ||
            n.type === 'homework_due' ||
            n.type === 'homework_overdue'
        ) {
            const q = p.lessonOrder ? `?lesson=${p.lessonOrder}` : '';
            nav(`/app/courses/${p.courseSlug}${q}`);
        }
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

    usePageMeta({
        title: 'Уведомления',
        description: 'Ваши уведомления на платформе MEDIA·RAF·RAW',
    });

    return (
        <div className="ui-notifications-page notifications-page">
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
                        >
                            ✓ Прочитать все
                        </button>
                    )}
                    {readCount > 0 && (
                        <button
                            onClick={() => setConfirm('clearRead')}
                            disabled={busy}
                            className="btn-ghost !py-2 text-sm"
                        >
                            🧹 Очистить прочитанные
                        </button>
                    )}
                    {total > 0 && (
                        <button
                            onClick={() => setConfirm('clearAll')}
                            disabled={busy}
                            className="btn-ghost !py-2 text-sm text-pink"
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
                    if (count === 0 && f.v !== 'all' && f.v !== 'unread') return null;
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
                {filtered.map((n) => {
                    const p = n.payload || {};
                    const subline = (() => {
                        if (n.type === 'message' || n.type === 'mention') {
                            return (
                                <>
                                    {p.chatTitle && (
                                        <span className="text-white/70">{p.chatTitle}: </span>
                                    )}
                                    {p.preview}
                                </>
                            );
                        }
                        if (n.type === 'post') return p.preview;
                        if (n.type === 'certificate') return p.courseTitle;
                        if (n.type === 'system') return p.message;
                        if (n.type === 'report') {
                            return (
                                <>
                                    Причина: {p.reason}
                                    {p.autoAction && (
                                        <span className="ml-2 text-pink">
                                            · авто: {p.autoAction}
                                        </span>
                                    )}
                                </>
                            );
                        }
                        if (n.type === 'lesson_new') {
                            return `в курсе «${p.courseTitle || ''}»`;
                        }
                        if (n.type === 'practical_scheduled') {
                            return p.scheduledAt
                                ? new Date(p.scheduledAt).toLocaleString('ru-RU', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit',
                                })
                                : '';
                        }
                        if (n.type === 'practical_due') {
                            return p.scheduledAt
                                ? `в ${new Date(p.scheduledAt).toLocaleTimeString('ru-RU', {
                                    hour: '2-digit', minute: '2-digit',
                                })}`
                                : '';
                        }
                        if (n.type === 'homework_due') {
                            return p.dueAt
                                ? `до ${new Date(p.dueAt).toLocaleString('ru-RU', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit',
                                })}`
                                : '';
                        }
                        if (n.type === 'lesson_unlocked') {
                            return `в курсе «${p.courseTitle || ''}»`;
                        }
                        if (n.type === 'homework_overdue') {
                            return p.dueAt
                                ? `срок истёк ${new Date(p.dueAt).toLocaleString('ru-RU', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit',
                                })}`
                                : '';
                        }
                        return null;
                    })();
                    return (
                        <div
                            key={n.id}
                            data-notification-item
                            className={`group px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer flex gap-3 ${
                                !n.readAt ? 'bg-violet/5' : ''
                            }`}
                            onClick={() => go(n)}
                        >
                            <div className="text-2xl shrink-0">{ICONS[n.type] || '🔔'}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">
                                    {(TITLES[n.type] || TITLES.system)(p)}
                                </div>
                                {subline && (
                                    <div className="text-xs text-white/50 truncate mt-0.5">
                                        {subline}
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
                    );
                })}
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