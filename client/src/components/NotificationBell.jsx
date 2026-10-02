import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

/* ─── Геометрия попапа ─── */

const PANEL_W = 400;            // ширина на ПК
const MIN_SPACE_BELOW = 340;    // если снизу меньше — открываем вверх
const MAX_HEIGHT = 600;         // жёсткий потолок высоты
const MIN_HEIGHT = 220;         // ниже этого не сжимаем
const GAP = 8;                  // отступ от кнопки-колокольчика
const EDGE = 8;                 // отступ от краёв экрана

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

    /* Закрытие по клику вне */
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

    /*
     * Позиционирование.
     *
     * useLayoutEffect — чтобы пересчёт произошёл синхронно до первой
     * отрисовки, иначе попап мелькнёт в неверном месте.
     *
     * Логика: считаем свободное место снизу и сверху от кнопки.
     * Если снизу меньше MIN_SPACE_BELOW и сверху места больше —
     * открываем вверх (bottom-anchor). Иначе — вниз (top-anchor).
     * Высота попапа ограничена реально доступным пространством.
     */
    useLayoutEffect(() => {
        if (!open || !btnRef.current) return;

        const compute = () => {
            if (!btnRef.current) return;
            const r = btnRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const width = Math.min(PANEL_W, vw - EDGE * 2);

            // Горизонтальное выравнивание + поджатие к краям
            let left = align === 'left' ? r.left : r.right - width;
            left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

            const spaceBelow = vh - r.bottom - GAP - EDGE;
            const spaceAbove = r.top - GAP - EDGE;

            const shouldOpenUp =
                spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;

            if (shouldOpenUp) {
                const h = Math.min(
                    MAX_HEIGHT,
                    Math.max(MIN_HEIGHT, spaceAbove)
                );
                setPos({
                    left,
                    bottom: vh - r.top + GAP,
                    width,
                    maxHeight: h,
                    openUp: true,
                });
            } else {
                const h = Math.min(
                    MAX_HEIGHT,
                    Math.max(MIN_HEIGHT, spaceBelow)
                );
                setPos({
                    left,
                    top: r.bottom + GAP,
                    width,
                    maxHeight: h,
                    openUp: false,
                });
            }
        };

        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [open, align]);

    /*
     * Закрытие по скроллу и Escape.
     *
     * Раньше здесь был безоговорочный setOpen(false) на любой scroll,
     * из-за чего прокрутка списка уведомлений внутри самой панели
     * мгновенно её закрывала.
     *
     * Теперь проверяем e.target: если событие пришло из панели —
     * игнорируем. Скролл страницы по-прежнему закрывает попап —
     * это ожидаемое поведение, чтобы при скролле контента попап
     * не «висел» в неправильном месте.
     */
    useEffect(() => {
        if (!open) return;

        const onScroll = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (btnRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };

        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
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
        try { await disablePush(); }
        finally { setBusy(false); }
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
                {/* ─── Шапка ─── */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">Уведомления</div>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-xs text-violet-soft hover:text-white whitespace-nowrap"
                                >
                                    Прочитать все
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="w-7 h-7 grid place-items-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                                title="Закрыть"
                                aria-label="Закрыть"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

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

                {/* ─── Список (скроллится, flex-1 min-h-0) ─── */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
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
                            {!n.readAt && (
                                <div className="w-2 h-2 rounded-full bg-pink shrink-0 mt-2" />
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                                className="opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-pink text-sm shrink-0"
                                title="Удалить"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                {/* ─── Футер со ссылкой на страницу ─── */}
                <Link
                    to="/app/notifications"
                    onClick={() => setOpen(false)}
                    className="shrink-0 block text-center px-4 py-3 border-t border-white/5 text-sm text-violet-soft hover:text-white hover:bg-white/5 transition"
                >
                    {items.length > 0
                        ? `Все уведомления (${items.length})`
                        : 'Открыть страницу уведомлений'}
                </Link>
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