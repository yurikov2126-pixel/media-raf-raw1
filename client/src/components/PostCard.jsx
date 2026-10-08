import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostReactions from './PostReactions.jsx';
import CommentSection from './CommentSection.jsx';
import ReportButton from './ReportButton.jsx';

export default function PostCard({ post, author, onChanged, onDeleted, compact = false }) {
    const { user, token } = useAuth();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(post.content || '');
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showComments, setShowComments] = useState(!compact);

    const isOwner = author?.id === user.id || post.authorId === user.id;
    const isAdmin = user.role === 'ADMIN';
    const canEdit = isOwner || isAdmin;

    const save = async () => {
        setBusy(true);
        try {
            const updated = await api(`/posts/${post.id}`, {
                method: 'PATCH',
                token,
                body: { content: text },
            });
            onChanged?.({ ...post, ...updated });
            setEditing(false);
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Удалить пост?')) return;
        try {
            await api(`/posts/${post.id}`, { method: 'DELETE', token });
            onDeleted?.(post.id);
        } catch (e) {
            alert(e.message);
        }
    };

    const commentCount = post._count?.comments ?? 0;
    const images = (() => {
        if (post.mediaUrls?.length) return post.mediaUrls;
        if (!post.mediaUrl) return [];
        if (post.mediaType === 'gallery') {
            try { const parsed = JSON.parse(post.mediaUrl); return Array.isArray(parsed) ? parsed : []; }
            catch { return []; }
        }
        return [post.mediaUrl];
    })();
    const [activeImage, setActiveImage] = useState(null);
    const gestureStart = useRef(null);
    useEffect(() => {
        if (activeImage === null) return;
        const onKey = (event) => {
            if (event.key === 'Escape') setActiveImage(null);
            if (event.key === 'ArrowRight') setActiveImage((index) => Math.min(images.length - 1, index + 1));
            if (event.key === 'ArrowLeft') setActiveImage((index) => Math.max(0, index - 1));
        };
        window.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [activeImage, images.length]);
    const onViewerTouchStart = (event) => {
        if (event.touches.length !== 1) { gestureStart.current = null; return; }
        gestureStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onViewerTouchEnd = (event) => {
        if (!gestureStart.current || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - gestureStart.current.x;
        const dy = event.changedTouches[0].clientY - gestureStart.current.y;
        gestureStart.current = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 55) return;
        if (Math.abs(dy) > Math.abs(dx) * 1.2) setActiveImage(null);
        else if (Math.abs(dx) > Math.abs(dy) * 1.2) {
            setActiveImage((index) => Math.max(0, Math.min(images.length - 1, index + (dx < 0 ? 1 : -1))));
        }
    };

    const cardPadding = compact ? 'p-3' : 'p-5';
    const avatarSize = compact ? 32 : 44;
    const authorTextSize = compact ? 'text-sm' : 'text-base';
    const contentClass = compact
        ? 'whitespace-pre-wrap text-white/90 text-sm line-clamp-3'
        : 'whitespace-pre-wrap text-white/90';
    const mediaMaxH = compact ? 'max-h-48' : '';
    const authorLinkMargin = compact ? 'mb-2' : 'mb-3';
    const reactionsMargin = compact ? 'mt-1' : 'mt-3';

    return (
        <article className={`card-flat ${cardPadding} post-stack relative`}>
            {/* Меню поста */}
            {(canEdit || !isOwner) && (
                <div className="absolute top-3 right-3 z-10">
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10 text-white/40"
                        aria-label="Меню"
                    >
                        ⋯
                    </button>
                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-9 z-20 card p-1 w-48 animate-pop">
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false);
                                                setEditing(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5"
                                        >
                                            ✏️ Редактировать
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false);
                                                remove();
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                                        >
                                            🗑️ Удалить
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Автор */}
            <Link
                to={`/app/u/${author?.username}`}
                className={`flex items-center gap-3 ${authorLinkMargin} hover:opacity-80`}
            >
                <Avatar user={author} size={avatarSize} />
                <div className="min-w-0 pr-8">
                    <div className={`font-semibold truncate ${authorTextSize}`}>
                        {author?.fullName || 'Автор'}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                        @{author?.username} · {new Date(post.createdAt).toLocaleString('ru-RU')}
                        {post.editedAt && <span className="ml-2 opacity-60">(изм.)</span>}
                    </div>
                </div>
            </Link>

            {/* Контент */}
            {editing ? (
                <div>
                    <textarea
                        className="input resize-none"
                        rows={3}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={() => {
                                setEditing(false);
                                setText(post.content || '');
                            }}
                            className="btn-ghost !py-2"
                        >
                            Отмена
                        </button>
                        <button onClick={save} disabled={busy} className="btn-primary !py-2">
                            {busy ? '…' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            ) : (
                post.content && <p className={contentClass}>{post.content}</p>
            )}

            {/* Медиа */}
            {images.length > 0 && (
                <div className={`${compact ? 'mt-2' : 'mt-3'} rounded-2xl overflow-hidden`}>
                    <div className={images.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
                        {images.map((url, index) => (
                            <button key={index} type="button" className="block w-full overflow-hidden rounded-xl" onClick={() => setActiveImage(index)} aria-label={`Открыть фото ${index + 1}`}>
                                <img src={resolveUrl(url)} alt={`Фото ${index + 1}`} className={`w-full object-cover ${images.length > 1 ? 'h-44 md:h-64' : mediaMaxH}`} loading="lazy" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeImage !== null && (
                <div className="fixed inset-0 z-[230] bg-black/95 flex flex-col items-center justify-center p-3" style={{ touchAction: 'pan-x pan-y' }} onTouchStart={onViewerTouchStart} onTouchEnd={onViewerTouchEnd} onTouchCancel={() => { gestureStart.current = null; }} role="dialog" aria-modal="true" aria-label="Просмотр фотографий">
                    <button type="button" className="absolute top-4 right-4 btn-ghost" onClick={() => setActiveImage(null)}>Закрыть ✕</button>
                    <img src={resolveUrl(images[activeImage])} alt={`Фото ${activeImage + 1}`} className="max-w-full max-h-[78vh] object-contain" />
                    <div className="flex gap-4 items-center mt-4">
                        <button type="button" className="btn-ghost" disabled={activeImage === 0} onClick={() => setActiveImage((i) => i - 1)}>←</button>
                        <span>{activeImage + 1} / {images.length}</span>
                        <button type="button" className="btn-ghost" disabled={activeImage === images.length - 1} onClick={() => setActiveImage((i) => i + 1)}>→</button>
                    </div>
                </div>
            )}
            {/* Реакции */}
            <div className={reactionsMargin}>
                <PostReactions
                    postId={post.id}
                    initial={{ reactions: post.reactions || [], my: [] }}
                />
            </div>

            {/* Жалоба — только на чужие */}
            {!isOwner && (
                <div className="mt-2 flex justify-end">
                    <ReportButton
                        targetType="post"
                        targetId={post.id}
                        className="chip bg-white/5 hover:bg-pink/30 text-xs"
                    />
                </div>
            )}

            {/* Комментарии: в компактном режиме — по кнопке */}
            {compact ? (
                <>
                    {!showComments && commentCount > 0 && (
                        <button
                            onClick={() => setShowComments(true)}
                            className="mt-3 text-sm text-violet-soft hover:text-white transition"
                        >
                            💬 Показать комментарии ({commentCount})
                        </button>
                    )}
                    {showComments && (
                        <div className="mt-3">
                            <CommentSection postId={post.id} initialCount={commentCount} />
                        </div>
                    )}
                </>
            ) : (
                <CommentSection postId={post.id} initialCount={commentCount} />
            )}
        </article>
    );
}