import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useNotifications } from '../store/notifications.jsx';
import { isIOS, isStandalone } from '../lib/push.js';

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

const PANEL_W = 380;

export default function NotificationBell({ align = 'right' }) {
    const {
        items, unread, pushState,
        enablePush, disablePush, markAllRead, markRead, remove,
    } = useNotifications();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const [busy, setBusy] = useState(false);
    const [pushError, setPushError] = useState('');
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

    useEffect(() => {
        if (!open || !btnRef.current) return;
        const compute = () => {
            const r = btnRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = Math.min(PANEL_W, vw - 16);
            let left = align === 'left' ? r.left : r.right - width;
            left = Math.max(8, Math.min(left, vw - width - 8));
            const top = Math.min(r.bottom + 8, vh - 100);
            const maxHeight = Math.max(200, vh - top - 16);
            setPos({ left, top, width, maxHeight });
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [open, align]);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (btnRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('scroll', close, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

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
        if (n.type === 'message' || n.type === 'mention') nav(`/app/chats/${n.payload.chatId}`);
        else if (n.type === 'post') nav(`/app/u/${n.payload.authorUsername}`);
        else if (n.type === 'certificate') nav(`/app/certificates/${n.payload.certificateId}`);
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

    const panel = open && pos
        ? createPortal(
            <div
                ref={panelRef}
                className="fixed z-[100] card p-0 overflow-hidden animate-pop flex flex-col"
                style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
            >
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="font-bold">Уведомления</div>
                        {unread > 0 && (
                            <button onClick={markAllRead} className="text-xs text-violet-soft hover:text-white">
                                Прочитать все
                            </button>
                        )}
                    </div>

                    {/* Статус push */}
                    {pushLabel && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
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

                    {pushError && (
                        <div className="mt-2 text-[11px] text-pink">{pushError}</div>
                    )}
                </div>

                <div
                    className="overflow-y-auto overscroll-contain"
                    style={{ maxHeight: pos.maxHeight - (pushLabel ? 90 : 60) }}
                >
                    {items.length === 0 && (
                        <div className="p-8 text-center text-white/40 text-sm">Пока пусто</div>
                    )}
                    {items.map((n) => (
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
                                    {(TITLES[n.type] || TITLES.system)(n.payload || {})}
                                </div>
                                {(n.type === 'message' || n.type === 'mention') && (
                                    <div className="text-xs text-white/50 truncate mt-0.5">
                                        {n.payload.chatTitle && (
                                            <span className="text-white/70">{n.payload.chatTitle}: </span>
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