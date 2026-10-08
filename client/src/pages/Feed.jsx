import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadBlob, uploadFile } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import usePostDraft from '../hooks/usePostDraft.js';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
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
    const [gallery, setGallery] = useState([]);
    const [cropping, setCropping] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [composeError, setComposeError] = useState('');
    const [preview, setPreview] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileRef = useRef(null);
    const draft = usePostDraft(user?.id);
    const text = draft.text;
    const setText = draft.setText;

    const [compact, setCompact] = useLocalStorage('mrr_feed_compact', false);

    const sentinelRef = useRef(null);
    const scrollRef = useRef(null);

    const publish = async () => {
        if ((!text.trim() && !image && !gallery.length) || uploading || publishing) return;
        setPublishing(true);
        setComposeError('');
        try {
            await api('/posts', {
                method: 'POST',
                token,
                body: { content: text, mediaUrl: gallery[0] || image || null, mediaUrls: gallery.length ? gallery : (image ? [image] : []), mediaType: gallery.length > 1 ? 'gallery' : (gallery.length || image ? 'image' : null) },
            });
            setText('');
            draft.clear();
            setImage('');
            setGallery([]);
            setComposeOpen(false);
            setPreview(false);
            setSelectedFile(null);
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
            const url = uploaded.absoluteUrl || uploaded.url || uploaded.path;
            if (!url) throw new Error('Сервер не вернул адрес фотографии');
            setGallery((previous) => [...previous, url].slice(0, 10));
            setImage('');
            setSelectedFile(null);
        } catch (e) {
            setComposeError(e.message || 'Не удалось загрузить фото');
        } finally {
            setUploading(false);
        }
    };

    const uploadOriginal = async () => {
        if (!selectedFile || uploading) return;
        setUploading(true);
        setComposeError('');
        try {
            const uploaded = await uploadFile(selectedFile, token);
            const url = uploaded.absoluteUrl || uploaded.url || uploaded.path;
            if (!url) throw new Error('Сервер не вернул адрес фотографии');
            setImage(url);
            setSelectedFile(null);
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
                    {selectedFile && !cropping && (
                        <div className="card p-3 mt-3 flex flex-wrap gap-2 items-center justify-between">
                            <span className="text-sm min-w-0 break-all">📷 {selectedFile.name}</span>
                            <div className="flex gap-2 flex-wrap">
                                <button type="button" className="btn-ghost" disabled={uploading} onClick={() => setCropping({ file: selectedFile })}>Обрезать (4:3)</button>
                                <button type="button" className="btn-primary" disabled={uploading} onClick={uploadOriginal}>{uploading ? 'Загрузка…' : 'Загрузить без обрезки'}</button>
                                <button type="button" className="btn-ghost" disabled={uploading} onClick={() => setSelectedFile(null)}>Убрать</button>
                            </div>
                        </div>
                    )}
                    {gallery.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">{gallery.map((url, index) => <div key={index} className="relative"><img src={url} alt={`Фото ${index + 1}`} className="h-32 w-full object-cover rounded-xl" /><button type="button" className="absolute right-1 top-1 bg-black/80 rounded-lg px-2" onClick={() => setGallery((a) => a.filter((_, i) => i !== index))} aria-label="Удалить фото">✕</button><div className="flex gap-1 mt-1"><button type="button" disabled={index === 0} onClick={() => setGallery((a) => { const b = [...a]; [b[index - 1], b[index]] = [b[index], b[index - 1]]; return b; })}>←</button><button type="button" disabled={index === gallery.length - 1} onClick={() => setGallery((a) => { const b = [...a]; [b[index + 1], b[index]] = [b[index], b[index + 1]]; return b; })}>→</button></div></div>)}</div>}
                    {image && <div className="relative mt-3"><img src={image} alt="Фото к публикации" className="max-h-80 w-full object-contain rounded-xl" /><button type="button" className="btn-ghost mt-2" onClick={() => { setImage(''); setSelectedFile(null); }}>Удалить фото</button></div>}
                    {preview && (
                        <div className="ui-compose-preview mt-4" aria-label="Предпросмотр публикации">
                            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Так публикация будет выглядеть в ленте</div>
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar user={user} size={40} />
                                <div className="min-w-0"><div className="font-semibold truncate">{user.fullName}</div><div className="text-xs text-white/40">@{user.username} · сейчас</div></div>
                            </div>
                            {text.trim() && <p className="whitespace-pre-wrap break-words text-white/90">{text}</p>}
                            {gallery.map((url, index) => <img key={index} className="w-full max-h-96 object-contain rounded-xl mt-3" src={url} alt={`Фото ${index + 1}`} />)}
                            {image && <img className="w-full max-h-96 object-contain rounded-xl mt-3" src={image} alt="Предпросмотр фотографии" />}
                            {!text.trim() && !image && !gallery.length && <p className="text-white/40 text-sm">Добавьте текст или фотографию для предпросмотра.</p>}
                        </div>
                    )}
                    {composeError && <p role="alert" className="text-pink text-sm mt-2">{composeError}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <button type="button" className="btn-ghost" disabled={uploading || publishing || gallery.length >= 10} onClick={() => fileRef.current?.click()}>{uploading ? 'Загрузка…' : '📷 Добавить фото'}</button>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file?.type.startsWith('image/')) { setSelectedFile(file); setComposeError(''); } else if (file) setComposeError('Выберите изображение'); }} />
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? "Скрыть предпросмотр" : "Предпросмотр"}</button>
                            <button type="button" className="btn-ghost" onClick={() => setComposeOpen(false)} disabled={publishing}>Закрыть</button>
                            <button type="button" className="btn-primary" onClick={publish} disabled={publishing || uploading || !!selectedFile || (!text.trim() && !image && !gallery.length)}>{publishing ? 'Публикуем…' : 'Опубликовать'}</button>
                        </div>
                    </div>
                </section>
            )}
            {cropping && <ImageCropper file={cropping.file} aspect={4 / 3} outputWidth={1280} outputHeight={960} title="Обрезка фото — перемещайте и масштабируйте" onDone={onCrop} onCancel={() => setCropping(null)} />}

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