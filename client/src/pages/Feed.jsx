import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';

export default function Feed() {
    const { user, token } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        if (!token) return;
        setLoading(true);
        api('/users', { token })
            .then(async (list) => {
                const profiles = await Promise.all(
                    list.slice(0, 15).map((u) => api(`/users/${u.username}`, { token }).catch(() => null))
                );
                const all = profiles
                    .filter(Boolean)
                    .flatMap((p) => (p.posts || []).map((post) => ({ post, author: p })));
                all.sort((a, b) => new Date(b.post.createdAt) - new Date(a.post.createdAt));
                setPosts(all);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [token]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="p-5 md:p-10 max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">
                Привет, {user.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-white/50 mb-8">Свежие публикации команды MEDIA-RAF-RAW</p>

            {loading && <div className="card p-10 text-center text-white/40">Загрузка ленты…</div>}

            {!loading && posts.length === 0 && (
                <div className="card p-10 text-center text-white/40">
                    Пока нет публикаций. Создайте первую запись у себя в профиле.
                </div>
            )}

            <div className="space-y-4">
                {posts.map(({ post, author }) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        author={author}
                        onChanged={(u) => setPosts((prev) => prev.map((x) => x.post.id === u.id ? { ...x, post: u } : x))}
                        onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.post.id !== id))}
                    />
                ))}
            </div>
        </div>
    );
}