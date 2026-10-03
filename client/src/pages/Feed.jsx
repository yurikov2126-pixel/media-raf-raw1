import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';
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

    const [compact, setCompact] = useLocalStorage('mrr_feed_compact', false);

    const sentinelRef = useRef(null);
    const scrollRef = useRef(null);

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
        <div ref={scrollRef} className="p-5 md:p-10 max-w-3xl mx-auto">
            <PullToRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />

            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-bold">
                    Привет, {user.fullName.split(' ')[0]} 👋
                </h1>
                <button
                    onClick={() => setCompact((c) => !c)}
                    className="chip bg-white/5 hover:bg-white/10 text-white/60 shrink-0"
                    title={compact ? 'Показать развёрнуто' : 'Показать компактно'}
                >
                    {compact ? '▤ Компактно' : '▥ Развёрнуто'}
                </button>
            </div>
            <p className="text-white/50 mb-8">Свежие публикации команды MEDIA-RAF-RAW</p>

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

            <div className={compact ? 'space-y-2' : 'space-y-4'}>
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