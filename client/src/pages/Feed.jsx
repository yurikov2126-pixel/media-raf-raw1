import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadBlob } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import usePostDraft from '../hooks/usePostDraft.js';
import Icon from '../components/Icon.jsx';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator.jsx';
import usePullToRefresh from '../hooks/usePullToRefresh.js';
import useLocalStorage from '../hooks/useLocalStorage.js';

const PAGE_SIZE = 20;

export default function Feed() {
    const { user, token } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState('');
    const [composeOpen, setComposeOpen] = useState(false);
    const [image, setImage] = useState('');
    const [cropping, setCropping] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [composeError, setComposeError] = useState('');
    const fileRef = useRef(null);
    const draft = usePostDraft(user?.id);
    const text = draft.text;
    const setText = draft.setText;

    const [compact, setCompact] = useLocalStorage('mrr_feed_compact', false);

    const sentinelRef = useRef(null);
    const scrollRef = useRef(null);

    const publish = async () => {
        if ((!text.trim() && !image) || uploading || publishing) return;
        setPublishing(true);
        setComposeError('');
        try {
            await api('/posts', {
                method: 'POST',
                token,
                body: { content: text, mediaUrl: image || null, mediaType: image ? 'image' : null },
            });
            setText('');
            draft.clear();
            setImage('');
            setComposeOpen(false);
            await loadInitial();
        } catch (e) {
            setComposeError(e.message || 'Не удалось опубликовать запись');
        } finally {
            setPublishing(false);
        }
    };

    const onCrop = async (blob) => {
        setCropping(null);
        setUploading(true);
        setComposeError('');
        try {
            const uploaded = await uploadBlob(blob, `post-${Date.now()}.jpg`, token);
            setImage(uploaded.absoluteUrl);
        } catch (e) {
            setComposeError(e.message || 'Не удалось загрузить фото');
        } finally {
            setUploading(false);
        }
    };

    /* Первичная загрузка */
    const loadInitial = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const r = await api(`/posts/feed?limit=${PAGE_SIZE}`, { token });
            setPosts(r.items);
            setCursor(r.nextCursor);
            setHasMore(!!r.nextCursor);
        } catch (e) {
            setError(e.message || 'Не удалось загрузить ленту');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    /* Подгрузка следующей страницы */
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !cursor || !token) return;
        setLoadingMore(true);
        try {
            const r = await api(
                `/posts/feed?limit=${PAGE_SIZE}&cursor=${cursor}`,
                { token }
            );
            setPosts((prev) => [...prev, ...r.items]);
            setCursor(r.nextCursor);
            setHasMore(!!r.nextCursor);
        } catch (e) {
            setError(e.message || 'Не удалось подгрузить');
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hasMore, loadingMore, token]);

    /* Infinite scroll */
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMore();
            },
            { rootMargin: '400px' }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [loadMore]);

    /* Pull-to-refresh */
    const { pull, refreshing, threshold } = usePullToRefresh({
        ref: scrollRef,
        onRefresh: loadInitial,
    });

    return (
        <div ref={scrollRef} className="ui-feed-page">
            <PullToRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />

            <div className="ui-feed-heading">
                <h1 className="text-3xl md:text-5xl font-bold">
                    Лента команды
                </h1>
                <button
                    onClick={() => setCompact((c) => !c)}
                    className="chip bg-white/5 hover:bg-white/10 text-white/60 shrink-0"
                    title={compact ? 'Показать развёрнуто' : 'Показать компактно'}
                >
                    {compact ? '▤ Компактно' : '▥ Развёрнуто'}
                </button>
            </div>
            <p className="ui-feed-subtitle">Свежие публикации MEDIA·RAF·RAW — идеи, проекты и события команды.</p>
            <button type="button" className="ui-feed-compose" onClick={() => setComposeOpen((v) => !v)} aria-expanded={composeOpen} aria-controls="feed-composer"><Icon name="plus" size={19} /> Новая публикация <Icon name="chevronRight" size={16} /></button>
            {composeOpen && (
                <section id="feed-composer" className="card p-4 md:p-6 mb-6" aria-label="Создание публикации">
                    <textarea autoFocus className="input resize-none w-full" rows={4} placeholder="Что нового у команды?" value={text} onChange={(e) => setText(e.target.value)} />
                    {draft.hasDraft && <p className="text-xs text-white/40 mt-2">Черновик сохраняется автоматически</p>}
                    {image && <div className="relative mt-3"><img src={image} alt="Фото к публикации" className="max-h-80 w-full object-contain rounded-xl" /><button type="button" className="btn-ghost mt-2" onClick={() => setImage('')}>Удалить фото</button></div>}
                    {composeError && <p role="alert" className="text-pink text-sm mt-2">{composeError}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <button type="button" className="btn-ghost" disabled={uploading || publishing} onClick={() => fileRef.current?.click()}>{uploading ? 'Загрузка…' : '📷 Добавить фото'}</button>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file?.type.startsWith('image/')) setCropping({ file }); }} />
                        <div className="flex gap-2">
                            <button type="button" className="btn-ghost" onClick={() => setComposeOpen(false)} disabled={publishing}>Закрыть</button>
                            <button type="button" className="btn-primary" onClick={publish} disabled={publishing || uploading || (!text.trim() && !image)}>{publishing ? 'Публикуем…' : 'Опубликовать'}</button>
                        </div>
                    </div>
                </section>
            )}
            {cropping && <ImageCropper file={cropping.file} aspect={4 / 3} outputWidth={1280} outputHeight={960} title="Обрезка изображения для поста" onDone={onCrop} onCancel={() => setCropping(null)} />}

            {loading && (
                <div className="card p-10 text-center text-white/40">Загрузка ленты…</div>
            )}

            {!loading && error && (
                <div className="card p-6 text-center">
                    <div className="text-pink mb-3">{error}</div>
                    <button onClick={loadInitial} className="btn-ghost">
                        Повторить
                    </button>
                </div>
            )}

            {!loading && !error && posts.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    Пока нет публикаций. Создайте первую запись у себя в профиле.
                </div>
            )}

            <div className={`ui-feed-posts ${compact ? 'space-y-2' : 'space-y-4'}`}>
                {posts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        author={post.author}
                        compact={compact}
                        onChanged={(u) =>
                            setPosts((prev) =>
                                prev.map((x) =>
                                    x.id === u.id ? { ...x, ...u } : x
                                )
                            )
                        }
                        onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
                    />
                ))}
            </div>

            <div ref={sentinelRef} className="h-4" />

            {loadingMore && (
                <div className="text-center text-white/40 py-6 text-sm">Загружаем ещё…</div>
            )}

            {!hasMore && posts.length > 0 && (
                <div className="text-center text-white/30 py-6 text-xs">Это всё 🌿</div>
            )}
        </div>
    );
}