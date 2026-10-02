import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';

const PAGE_SIZE = 20;

export default function Feed() {
    const { user, token } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState('');
    const sentinelRef = useRef(null);

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
            const r = await api(`/posts/feed?limit=${PAGE_SIZE}&cursor=${cursor}`, { token });
            setPosts((prev) => [...prev, ...r.items]);
            setCursor(r.nextCursor);
            setHasMore(!!r.nextCursor);
        } catch (e) {
            setError(e.message || 'Не удалось подгрузить');
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hasMore, loadingMore, token]);

    /* Infinite scroll: IntersectionObserver на сентинел внизу */
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

    return (
        <div className="p-5 md:p-10 max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">
                Привет, {user.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-white/50 mb-8">Свежие публикации команды MEDIA-RAF-RAW</p>

            {loading && <div className="card p-10 text-center text-white/40">Загрузка ленты…</div>}

            {!loading && error && (
                <div className="card p-6 text-center">
                    <div className="text-pink mb-3">{error}</div>
                    <button onClick={loadInitial} className="btn-ghost">Повторить</button>
                </div>
            )}

            {!loading && !error && posts.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    Пока нет публикаций. Создайте первую запись у себя в профиле.
                </div>
            )}

            <div className="space-y-4">
                {posts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        author={post.author}
                        onChanged={(u) =>
                            setPosts((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)))
                        }
                        onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
                    />
                ))}
            </div>

            {/* Sentinel для infinite scroll */}
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