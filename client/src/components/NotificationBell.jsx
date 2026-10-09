import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useNotifications } from '../store/notifications.jsx';
import { isIOS, isStandalone } from '../lib/push.js';

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

const PANEL_W = 400;
const MIN_SPACE_BELOW = 340;
const MAX_HEIGHT = 600;
const MIN_HEIGHT = 220;
const GAP = 8;
const EDGE = 8;

export default function NotificationBell({ align = 'right' }) {
    const {
        items, unread, readCount, pushState,
        enablePush, disablePush,
        markAllRead, markRead, remove,
        removeRead, removeAll,
    } = useNotifications();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const [busy, setBusy] = useState(false);
    const [pushError, setPushError] = useState('');
    const [confirm, setConfirm] = useState(null);
    const [actionMsg, setActionMsg] = useState('');
    const btnRef = useRef(null);
    const panelRef = useRef(null);
    const nav = useNavigate();

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (btnRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('touchstart', onDoc);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('touchstart', onDoc);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !btnRef.current) return;
        const compute = () => {
            if (!btnRef.current) return;
            const r = btnRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = Math.min(PANEL_W, vw - EDGE * 2);
            let left = align === 'left' ? r.left : r.right - width;
            left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

            const spaceBelow = vh - r.bottom - GAP - EDGE;
            const spaceAbove = r.top - GAP - EDGE;
            const shouldOpenUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;

            if (shouldOpenUp) {
                const h = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, spaceAbove));
                setPos({ left, bottom: vh - r.top + GAP, width, maxHeight: h, openUp: true });
            } else {
                const h = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, spaceBelow));
                setPos({ left, top: r.bottom + GAP, width, maxHeight: h, openUp: false });
            }
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [open, align]);

    useEffect(() => {
        if (!open) return;
        const onScroll = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (btnRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (confirm) setConfirm(null);
                else setOpen(false);
            }
        };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [open, confirm]);

    const handleEnable = async () => {
        setBusy(true);
        setPushError('');
        try {
            const r = await enablePush();
            if (r?.error) setPushError(r.error);
        } catch (e) {
            setPushError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleDisable = async () => {
        setBusy(true);
        try {
            await disablePush();
        } finally {
            setBusy(false);
        }
    };

    const handleClick = async (n) => {
        if (!n.readAt) await markRead(n.id);
        setOpen(false);
        const p = n.payload || {};
        if (n.type === 'mention' && p.postId) nav(`/app/feed?post=${encodeURIComponent(p.postId)}${p.commentId ? `&comment=${encodeURIComponent(p.commentId)}` : ''}`);
        else if ((n.type === 'message' || n.type === 'mention') && p.chatId) nav(`/app/chats/${encodeURIComponent(p.chatId)}`);
        else if (n.type === 'mention') nav('/app/notifications');
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

    const flashMsg = (text) => {
        setActionMsg(text);
        setTimeout(() => setActionMsg(''), 2000);
    };

    const doClear = async () => {
        setBusy(true);
        try {
            if (confirm === 'clearRead') {
                const n = await removeRead();
                flashMsg(n > 0 ? `Удалено: ${n}` : 'Нечего удалять');
            } else if (confirm === 'clearAll') {
                const n = await removeAll();
                flashMsg(n > 0 ? `Удалено: ${n}` : 'Пусто');
            }
        } catch (e) {
            flashMsg('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const pushLabel = (() => {
        if (!pushState.supported) return null;
        if (pushState.permission === 'denied') {
            return { text: 'Заблокировано в браузере', action: null, disabled: true };
        }
        if (pushState.subscribed) {
            return { text: '🔔 Уведомления включены', action: handleDisable, label: 'Отключить' };
        }
        if (isIOS() && !isStandalone()) {
            return { text: '📱 Добавьте на экран «Домой»', action: null, disabled: true };
        }
        return { text: 'Включить push', action: handleEnable, label: '🔔 Включить' };
    })();

    const style = pos
        ? {
            left: pos.left,
            top: pos.openUp ? 'auto' : pos.top,
            bottom: pos.openUp ? pos.bottom : 'auto',
            width: pos.width,
            maxHeight: pos.maxHeight,
        }
        : {};

    const panel = open && pos
        ? createPortal(
            <div
                ref={panelRef}
                className="fixed z-[100] card p-0 overflow-hidden animate-pop flex flex-col"
                style={style}
            >
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-bold">
                            Уведомления
                            {items.length > 0 && (
                                <span className="text-white/40 font-normal text-xs ml-2">
                                    {items.length}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="w-7 h-7 grid place-items-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                            title="Закрыть"
                        >
                            ✕
                        </button>
                    </div>

                    {items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {unread > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="chip bg-violet/20 hover:bg-violet/40 text-white text-[11px]"
                                >
                                    ✓ Прочитать все ({unread})
                                </button>
                            )}
                            {readCount > 0 && (
                                <button
                                    onClick={() => setConfirm('clearRead')}
                                    className="chip bg-white/5 hover:bg-white/10 text-white/70 text-[11px]"
                                >
                                    🧹 Очистить прочитанные ({readCount})
                                </button>
                            )}
                            <button
                                onClick={() => setConfirm('clearAll')}
                                className="chip bg-white/5 hover:bg-pink/30 text-white/70 text-[11px]"
                            >
                                🗑️ Очистить всё
                            </button>
                        </div>
                    )}

                    {pushLabel && (
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                            <span className="text-white/50 truncate">{pushLabel.text}</span>
                            {pushLabel.action && (
                                <button
                                    onClick={pushLabel.action}
                                    disabled={busy}
                                    className="chip bg-violet/30 hover:bg-violet/50 text-white shrink-0"
                                >
                                    {busy ? '…' : pushLabel.label || 'Включить'}
                                </button>
                            )}
                        </div>
                    )}

                    {pushError && <div className="mt-2 text-[11px] text-pink">{pushError}</div>}
                    {actionMsg && (
                        <div className="mt-2 text-[11px] text-lime">{actionMsg}</div>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {items.length === 0 && (
                        <div className="p-8 text-center text-white/40 text-sm">Пока пусто</div>
                    )}
                    {items.map((n) => {
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
                                className={`group px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer flex gap-3 ${
                                    !n.readAt ? 'bg-violet/5' : ''
                                }`}
                                onClick={() => handleClick(n)}
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

                <Link
                    to="/app/notifications"
                    onClick={() => setOpen(false)}
                    className="shrink-0 block text-center px-4 py-3 border-t border-white/5 text-sm text-violet-soft hover:text-white hover:bg-white/5 transition"
                >
                    {items.length > 0
                        ? `Все уведомления (${items.length})`
                        : 'Открыть страницу уведомлений'}
                </Link>

                {confirm && (
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card p-5 max-w-sm w-full">
                            <div className="text-2xl mb-2">
                                {confirm === 'clearAll' ? '⚠️' : '🧹'}
                            </div>
                            <div className="font-bold text-lg mb-2">
                                {confirm === 'clearAll'
                                    ? 'Очистить все уведомления?'
                                    : 'Очистить прочитанные?'}
                            </div>
                            <div className="text-sm text-white/60 mb-4">
                                {confirm === 'clearAll'
                                    ? `Будут удалены все ${items.length} уведомлений, включая непрочитанные. Действие необратимо.`
                                    : `Будут удалены ${readCount} прочитанных уведомлений. Непрочитанные останутся.`}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setConfirm(null)}
                                    disabled={busy}
                                    className="btn-ghost"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={doClear}
                                    disabled={busy}
                                    className="btn-primary !bg-pink"
                                >
                                    {busy ? '…' : 'Удалить'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>,
            document.body
        )
        : null;

    return (
        <div className="relative">
            <button
                ref={btnRef}
                onClick={() => setOpen((o) => !o)}
                className="relative w-11 h-11 grid place-items-center rounded-2xl hover:bg-white/5 transition"
                title="Уведомления"
                aria-expanded={open}
            >
                <span className="text-xl">🔔</span>
                {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-white text-[10px] font-bold grid place-items-center">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
            {panel}
        </div>
    );
}