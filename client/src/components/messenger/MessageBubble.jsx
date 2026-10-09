import { useMemo, useRef, useState } from 'react';
import Avatar from '../Avatar.jsx';
import MessageText from '../MessageText.jsx';
import VoicePlayer from '../VoicePlayer.jsx';
import { resolveUrl } from '../../api/client.js';
import { Sticker } from '../../stickers/pack.jsx';

export default function MessageBubble({
                                          m, isOwn, highlight, onlineSet,
                                          onOpenImage, onOpenProfile, onScrollToReply, onLongPress, onReact, onSwipeReply,
                                      }) {
    const longPressTimer = useRef(null);
    const startPos = useRef(null);
    const [swipeX, setSwipeX] = useState(0);
    const swipeRef = useRef(0);

    const grouped = (m.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {});
    const forwarded = m.forwardedFrom ? JSON.parse(m.forwardedFrom) : null;

    const startLongPress = (e) => {
        const touch = e.touches?.[0];
        startPos.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        swipeRef.current = 0;
        setSwipeX(0);
        clearTimeout(longPressTimer.current);
        longPressTimer.current = setTimeout(() => {
            if (m.deletedAt) return;
            onLongPress?.(e);
        }, 500);
    };
    const moveLongPress = (e) => {
        const touch = e.touches?.[0];
        if (!touch || !startPos.current) return;
        const dx = touch.clientX - startPos.current.x;
        const dy = touch.clientY - startPos.current.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(longPressTimer.current);
        // Horizontal right swipe to reply. Ignore vertical scrolling and left swipes.
        if (Math.abs(dx) > Math.abs(dy) * 1.3 && dx > 0 && !m.deletedAt) {
            swipeRef.current = Math.min(72, dx);
            setSwipeX(swipeRef.current);
        } else if (swipeRef.current) {
            swipeRef.current = 0;
            setSwipeX(0);
        }
    };
    const endLongPress = () => {
        clearTimeout(longPressTimer.current);
        if (swipeRef.current >= 56 && !m.deletedAt) onSwipeReply?.(m);
        swipeRef.current = 0;
        setSwipeX(0);
        startPos.current = null;
    };
    const onCtx = (e) => {
        e.preventDefault();
        if (!m.deletedAt) onLongPress?.(e);
    };

    const highlights = useMemo(() => {
        const set = new Set();
        if (m.type === 'text' && m.content) {
            const re = /@([a-z0-9_]{3,20})/gi;
            let mm;
            while ((mm = re.exec(m.content)) !== null) set.add(mm[1].toLowerCase());
        }
        return set;
    }, [m.content, m.type]);

    const isMediaOnly = ['sticker', 'image', 'video'].includes(m.type);

    /* Классы пузыря:
       - mrr-own-bubble — на своих (градиент): гарантирует белый текст
         в светлой теме (иначе глобальный overrides text-white делает
         его тёмным и текст плохо виден на градиенте).
       - mrr-other-bubble — на чужих: в светлой теме получает белый
         фон с тенью и рамкой вместо серого bg-ink-700. */
    const bubbleClass = isMediaOnly
        ? 'bg-transparent !p-0'
        : isOwn
            ? 'text-white mrr-own-bubble'
            : 'bg-ink-700 text-white mrr-other-bubble';

    return (
        <div
            id={`msg-${m.id}`}
            className={`group relative flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} rounded-2xl transition ${
                highlight ? 'bg-violet/20 ring-2 ring-violet/60' : ''
            }`}
        >
            {swipeX > 12 && (
                <span className="absolute left-3 self-center text-violet-soft pointer-events-none text-xl" aria-hidden="true">↩</span>
            )}
            {!isOwn && (
                <button onClick={onOpenProfile} className="shrink-0 hover:opacity-80 transition">
                    <Avatar user={m.sender} size={34} online={onlineSet?.has(m.sender.id)} />
                </button>
            )}
            <div
                style={{ transform: `translateX(${swipeX}px)`, transition: swipeX ? 'none' : 'transform 180ms ease-out' }}
                className={`max-w-[80%] md:max-w-[65%] ${
                    isOwn ? 'items-end' : 'items-start'
                } flex flex-col`}
            >
                {!isOwn && (
                    <button
                        onClick={onOpenProfile}
                        className="text-xs text-white/40 px-2 mb-1 hover:text-white/70 transition text-left"
                    >
                        {m.sender.fullName}
                    </button>
                )}

                <div
                    onDoubleClick={() => onReact?.('❤️')}
                    onTouchStart={startLongPress}
                    onTouchMove={moveLongPress}
                    onTouchEnd={endLongPress}
                    onTouchCancel={endLongPress}
                    onContextMenu={onCtx}
                    className={`relative rounded-2xl px-3 py-2 select-none ${bubbleClass}`}
                    style={
                        isOwn && !isMediaOnly
                            ? { background: 'var(--brand-gradient)' }
                            : undefined
                    }
                >
                    {forwarded && (
                        <div className="text-xs opacity-70 mb-1 italic">
                            ↪ Переслано от {forwarded.fullName}
                        </div>
                    )}
                    {m.replyTo && (
                        <button
                            onClick={() => onScrollToReply?.(m.replyTo.id)}
                            className="block w-full text-left border-l-2 border-white/40 pl-2 mb-1 text-xs opacity-80 hover:opacity-100"
                        >
                            <div className="font-bold">{m.replyTo.sender?.fullName}</div>
                            <div className="truncate max-w-[200px]">
                                {m.replyTo.type === 'image'
                                    ? '🖼️ Изображение'
                                    : m.replyTo.type === 'video'
                                        ? '🎥 Видео'
                                        : m.replyTo.type === 'voice'
                                            ? '🎤 Голосовое'
                                            : m.replyTo.type === 'file'
                                                ? '📎 Файл'
                                                : m.replyTo.content}
                            </div>
                        </button>
                    )}

                    {m.deletedAt ? (
                        <div className="italic opacity-50 text-sm px-2">сообщение удалено</div>
                    ) : m.type === 'sticker' ? (
                        <Sticker id={m.content} size={120} />
                    ) : m.type === 'image' ? (
                        <button
                            type="button"
                            onClick={onOpenImage}
                            className="block rounded-2xl overflow-hidden hover:opacity-95 transition max-w-[240px] md:max-w-[300px]"
                        >
                            <img
                                src={resolveUrl(m.content)}
                                alt=""
                                className="block w-full h-auto object-cover"
                                loading="lazy"
                            />
                        </button>
                    ) : m.type === 'video' ? (
                        <div className="rounded-2xl overflow-hidden max-w-[280px] md:max-w-[340px] bg-black">
                            <video
                                src={resolveUrl(m.content)}
                                controls
                                className="block w-full h-auto"
                                preload="metadata"
                            />
                        </div>
                    ) : m.type === 'voice' ? (
                        <VoicePlayer src={m.content} isOwn={isOwn} />
                    ) : m.type === 'file' ? (
                        <a
                            href={resolveUrl(m.content)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 transition max-w-[240px]"
                        >
                            <div className="text-2xl">📎</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">
                                    {decodeURIComponent((m.content || '').split('/').pop() || 'Файл')}
                                </div>
                                <div className="text-[10px] opacity-60">Скачать</div>
                            </div>
                        </a>
                    ) : (
                        <MessageText text={m.content} highlights={highlights} />
                    )}

                    {m.editedAt && !m.deletedAt && (
                        <span className="text-[10px] opacity-60 ml-1">(изм.)</span>
                    )}

                    {Object.keys(grouped).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(grouped).map(([emoji, count]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact?.(emoji)}
                                    className={`text-xs rounded-full px-2 py-0.5 ${
                                        isOwn ? 'bg-black/20' : 'bg-white/10'
                                    } hover:bg-white/20`}
                                >
                                    {emoji} {count > 1 && count}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-[10px] text-white/30 px-2 mt-1">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </div>
            </div>
        </div>
    );
}