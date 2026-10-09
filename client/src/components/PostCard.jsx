import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Avatar from './Avatar.jsx';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostReactions from './PostReactions.jsx';
import CommentSection from './CommentSection.jsx';
import ReportButton from './ReportButton.jsx';

export default function PostCard({ post, author, onChanged, onDeleted, onPinned, compact = false, onTagClick, onReposted }) {
    const { user, token } = useAuth();
    const [editing, setEditing] = useState(false);
    const [socialBusy, setSocialBusy] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareText, setShareText] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);
    const [saved, setSaved] = useState(Boolean(post.isSaved));
    const [savedCount, setSavedCount] = useState(post._count?.savedBy ?? null);
    const [repostCount, setRepostCount] = useState(post._count?.reposts ?? null);
    useEffect(() => { setSavedCount(post._count?.savedBy ?? null); setRepostCount(post._count?.reposts ?? null); }, [post._count?.savedBy, post._count?.reposts]);
    useEffect(() => { setSaved(Boolean(post.isSaved)); }, [post.isSaved]);
    const toggleSave = async () => {
        if (socialBusy) return;
        setSocialBusy(true);
        try { const result = await api(`/feed2/posts/${post.id}/save`, { method: saved ? 'DELETE' : 'PUT', token }); setSaved(result.saved); setSavedCount((n) => n === null ? n : Math.max(0, n + (result.saved ? 1 : -1))); onChanged?.({ id: post.id, isSaved: result.saved }); }
        catch (e) { alert(e.message || 'Не удалось изменить закладку'); } finally { setSocialBusy(false); }
    };
    const sharePost = async () => {
        const url = new URL('/app/feed', window.location.origin);
        url.searchParams.set('post', post.id);
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Публикация MEDIA·RAF·RAW', url: url.toString() });
            } else {
                await navigator.clipboard.writeText(url.toString());
                setLinkCopied(true);
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                try { await navigator.clipboard.writeText(url.toString()); setLinkCopied(true); }
                catch { window.prompt('Скопируйте ссылку на публикацию:', url.toString()); }
            }
        }
    };
    const repost = async () => {
        if (socialBusy) return;
        setSocialBusy(true);
        try { await api(`/feed2/posts/${post.id}/repost`, { method: 'POST', token, body: { content: shareText } }); setShareOpen(false); setShareText(''); setRepostCount((n) => n === null ? n : n + 1); onReposted?.(); }
        catch (e) { alert(e.message || 'Не удалось сделать репост'); } finally { setSocialBusy(false); }
    };
    const [text, setText] = useState(post.content || '');
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showComments, setShowComments] = useState(!compact);
    const [mediaEditing, setMediaEditing] = useState(false);
    const [mediaDraft, setMediaDraft] = useState(null);
    const [mediaError, setMediaError] = useState('');
    const [mediaSaving, setMediaSaving] = useState(false);
    const mediaDrag = useRef(null);
    const [draggingMedia, setDraggingMedia] = useState(null);

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

    const togglePin = async () => {
        setBusy(true);
        setMenuOpen(false);
        try {
            const result = await api(`/posts/${post.id}/pin`, { method: 'PATCH', token, body: { pinned: !post.pinnedAt } });
            onChanged?.({ ...post, pinnedAt: result.pinnedAt });
            onPinned?.();
        } catch (error) { alert(error.message || 'Не удалось изменить закрепление'); }
        finally { setBusy(false); }
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
    const beginMediaEdit = () => { setMediaDraft([...images]); setMediaError(''); setMediaEditing(true); setMenuOpen(false); };
    const reorderMedia = (source, target) => setMediaDraft((prev) => {
        if (!prev || source === target || !prev.includes(source) || !prev.includes(target)) return prev;
        const next = [...prev]; next.splice(next.indexOf(target), 0, next.splice(next.indexOf(source), 1)[0]); return next;
    });
    const saveMedia = async () => {
        setMediaSaving(true); setMediaError('');
        try {
            const updated = await api(`/posts/${post.id}`, { method: 'PATCH', token, body: { mediaUrls: mediaDraft } });
            onChanged?.({ ...post, ...updated });
            setMediaEditing(false);
        } catch (error) { setMediaError(error.message || 'Не удалось сохранить фотографии'); }
        finally { setMediaSaving(false); }
    };
    const [activeImage, setActiveImage] = useState(null);
    const gestureStart = useRef(null);
    const reduceMotion = useReducedMotion();
    const [slideDirection, setSlideDirection] = useState(0);
    const navigatePhoto = (delta) => {
        setSlideDirection(delta);
        setActiveImage((index) => Math.max(0, Math.min(images.length - 1, index + delta)));
    };
    useEffect(() => {
        if (activeImage === null) return;
        const onKey = (event) => {
            if (event.key === 'Escape') setActiveImage(null);
            if (event.key === 'ArrowRight') navigatePhoto(1);
            if (event.key === 'ArrowLeft') navigatePhoto(-1);
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
            navigatePhoto(dx < 0 ? 1 : -1);
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
                                        {isOwner && <button type="button" disabled={busy} onClick={togglePin} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5">{post.pinnedAt ? '📌 Открепить' : '📌 Закрепить в профиле'}</button>}
                                        {images.length > 0 && <button type="button" className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5" onClick={beginMediaEdit}>🖼️ Изменить фотографии</button>}
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

            {post.pinnedAt && <div className="flex items-center gap-1 text-xs font-medium text-violet-300 mb-3" aria-label="Закреплённая публикация">📌 Закреплённая публикация</div>}
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
                post.content && <p className={contentClass}>{post.content.split(/(#[\p{L}\p{N}_]{1,50}|@[\p{L}\p{N}_]{1,50})/u).map((part, index) => /^#[\p{L}\p{N}_]{1,50}$/u.test(part) ? <button key={index} type="button" className="text-violet-500 hover:underline" onClick={() => onTagClick ? onTagClick(part.slice(1)) : window.location.assign(`/app/feed?tag=${encodeURIComponent(part.slice(1))}`)}>{part}</button> : /^@[\p{L}\p{N}_]{1,50}$/u.test(part) ? <Link key={index} className="text-violet-500 hover:underline font-semibold" to={`/app/u/${part.slice(1)}`}>{part}</Link> : part)}</p>
            )}

            {mediaEditing && mediaDraft && (
                <div className="mt-3 rounded-2xl border border-violet-400/30 bg-violet-500/5 p-3">
                    <div className="font-semibold mb-2">Редактирование фотографий</div>
                    <p className="text-xs text-white/50 mb-3">Перетащите фото за ручку, чтобы изменить порядок. Удаление применяется после сохранения.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {mediaDraft.map((url, index) => (
                            <div key={url} data-media-url={url} className={`rounded-xl bg-white/5 p-2 ${draggingMedia === url ? 'ring-2 ring-violet-400 opacity-70' : ''}`}>
                                <img src={resolveUrl(url)} alt={`Фото ${index + 1}`} className="w-full h-28 object-cover rounded-lg" />
                                <div className="flex items-center justify-between mt-2">
                                    <button type="button" aria-label={`Переместить фото ${index + 1}`} className="touch-none cursor-grab rounded-lg bg-white/10 px-3 py-2" onPointerDown={(e) => { if (mediaSaving) return; mediaDrag.current = url; setDraggingMedia(url); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!mediaDrag.current) return; const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-media-url]')?.getAttribute('data-media-url'); if (target) reorderMedia(mediaDrag.current, target); }} onPointerUp={() => { mediaDrag.current = null; setDraggingMedia(null); }} onPointerCancel={() => { mediaDrag.current = null; setDraggingMedia(null); }}>⠿</button>
                                    <button type="button" className="text-pink text-xs px-2 py-2" disabled={mediaSaving} onClick={() => setMediaDraft((prev) => prev.filter((u) => u !== url))}>Удалить</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {mediaError && <p role="alert" className="text-pink text-sm mt-2">{mediaError}</p>}
                    <div className="flex gap-2 justify-end mt-3">
                        <button type="button" className="btn-ghost" disabled={mediaSaving} onClick={() => setMediaEditing(false)}>Отмена</button>
                        <button type="button" className="btn-primary" disabled={mediaSaving || (!mediaDraft.length && !post.content?.trim())} onClick={saveMedia}>{mediaSaving ? 'Сохраняем…' : 'Сохранить фото'}</button>
                    </div>
                </div>
            )}
            {post.repostOf && <div className="mt-3 rounded-2xl border border-white/15 bg-white/[.035] p-4">
                <div className="text-xs text-white/45 mb-2">↗ Репост публикации</div>
                <Link to={`/app/u/${post.repostOf.author?.username}`} className="text-sm font-semibold text-violet-200 hover:underline">{post.repostOf.author?.fullName || 'Автор оригинала'}</Link>
                <p className="text-sm text-white/80 whitespace-pre-wrap mt-2">{post.repostOf.content}</p>
                {post.repostOf.mediaUrl && <img src={resolveUrl(post.repostOf.mediaUrl)} alt="Медиа оригинальной публикации" loading="lazy" className="w-full max-h-80 object-contain rounded-xl mt-3" />}
            </div>}
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

            {createPortal(<AnimatePresence>
                {activeImage !== null && (
                    <motion.div
                        key="photo-viewer"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22 }}
                        className="fixed inset-0 z-[230] bg-[#080811]/95 backdrop-blur-xl flex flex-col items-center justify-center px-3 py-8"
                        style={{ touchAction: 'none' }}
                        onTouchStart={onViewerTouchStart}
                        onTouchEnd={onViewerTouchEnd}
                        onTouchCancel={() => { gestureStart.current = null; }}
                        role="dialog" aria-modal="true" aria-label="Просмотр фотографий"
                    >
                        <button type="button" className="absolute top-5 right-5 z-10 grid place-items-center w-11 h-11 rounded-full bg-white/10 border border-white/15 text-white hover:bg-violet-500/25 transition-colors" onClick={() => setActiveImage(null)} aria-label="Закрыть просмотр">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                        <div className="relative flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden">
                            <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                                <motion.img
                                    key={activeImage}
                                    src={resolveUrl(images[activeImage])}
                                    alt={`Фото ${activeImage + 1}`}
                                    custom={slideDirection}
                                    initial={reduceMotion ? false : { opacity: 0, x: slideDirection * 64, scale: 0.965 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideDirection * -64, scale: 0.965 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeOut' }}
                                    className="max-w-full max-h-full object-contain rounded-xl select-none"
                                    draggable={false}
                                />
                            </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-5 mt-5 shrink-0">
                            <button type="button" className="grid place-items-center w-12 h-12 rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-all hover:bg-violet-500/25 hover:border-violet-400/50 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95" disabled={activeImage === 0} onClick={() => navigatePhoto(-1)} aria-label="Предыдущее фото">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span className="min-w-16 text-center text-sm font-semibold tracking-wider text-white/75" aria-live="polite">{activeImage + 1} / {images.length}</span>
                            <button type="button" className="grid place-items-center w-12 h-12 rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-all hover:bg-violet-500/25 hover:border-violet-400/50 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95" disabled={activeImage === images.length - 1} onClick={() => navigatePhoto(1)} aria-label="Следующее фото">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>, document.body)}
            {/* Реакции */}
            <div className={reactionsMargin}>
                <PostReactions
                    postId={post.id}
                    initial={{ reactions: post.reactions || [], my: [] }}
                />
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10">
                <button type="button" disabled={socialBusy} onClick={toggleSave} aria-pressed={saved} className={`chip text-xs feed-save-button ${saved ? 'feed-save-button--active' : 'bg-white/5 text-white/60'}`}>{saved ? '🔖 Сохранено' : '🔖 Сохранить'}{savedCount !== null ? ` · ${savedCount}` : ''}</button>
                <button type="button" onClick={sharePost} className="chip bg-white/5 text-white/60 text-xs" aria-label="Поделиться ссылкой на публикацию">{linkCopied ? '✓ Ссылка скопирована' : '🔗 Ссылка'}</button>
                <button type="button" onClick={() => setShareOpen((v) => !v)} aria-expanded={shareOpen} className="chip bg-white/5 text-white/60 text-xs">↗ Репост{repostCount !== null ? ` · ${repostCount}` : ''}</button>
            </div>
            {shareOpen && <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <label className="text-sm font-semibold block" htmlFor={`repost-${post.id}`}>Поделиться публикацией</label>
                <textarea id={`repost-${post.id}`} className="input w-full" maxLength={1000} rows={2} value={shareText} onChange={(e) => setShareText(e.target.value)} placeholder="Добавьте комментарий (необязательно)" />
                <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setShareOpen(false)}>Отмена</button><button type="button" disabled={socialBusy} className="btn-primary" onClick={repost}>{socialBusy ? 'Отправка…' : 'Опубликовать репост'}</button></div>
            </div>}
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