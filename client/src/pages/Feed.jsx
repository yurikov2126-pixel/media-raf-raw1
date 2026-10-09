import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostCard from '../components/PostCard.jsx';
import PostComposer from '../components/PostComposer.jsx';
import Icon from '../components/Icon.jsx';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator.jsx';
import usePullToRefresh from '../hooks/usePullToRefresh.js';
import useLocalStorage from '../hooks/useLocalStorage.js';

const PAGE_SIZE = 20;
// Keep only a few recent feed views in memory; never persist user posts.
const feedSnapshots = new Map();
const SNAPSHOT_TTL = 5 * 60 * 1000;
function readSnapshot(key) {
    const entry = feedSnapshots.get(key);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > SNAPSHOT_TTL) { feedSnapshots.delete(key); return null; }
    return entry;
}
function saveSnapshot(key, value) {
    feedSnapshots.delete(key);
    feedSnapshots.set(key, { ...value, savedAt: Date.now() });
    if (feedSnapshots.size > 6) feedSnapshots.delete(feedSnapshots.keys().next().value);
}

export default function Feed() {
    const { user, token } = useAuth();
    const [params, setParams] = useSearchParams();
    const mode = ['latest', 'recommended', 'saved', 'mine'].includes(params.get('mode')) ? params.get('mode') : 'latest';
    const tag = params.get('tag') || '';
    const query = params.get('q') || '';
    const author = params.get('author') || '';
    const period = params.get('period') || 'all';
    const sort = params.get('sort') || 'newest';
    const hasActiveFilters = Boolean(query || author || tag || period !== 'all' || sort !== 'newest');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchDraft, setSearchDraft] = useState(query);
    const [authorDraft, setAuthorDraft] = useState(author);
    const [authorSuggestions, setAuthorSuggestions] = useState([]);
    const [trending, setTrending] = useState([]);
    const linkedPostId = params.get('post') || '';
    const linkedCommentId = params.get('comment') || '';
    const [linkedPost, setLinkedPost] = useState(null);
    const [linkedError, setLinkedError] = useState('');
    const [focusedComment, setFocusedComment] = useState(null);
    const [focusedCommentStatus, setFocusedCommentStatus] = useState('');
    const snapshotKey = JSON.stringify([user?.id, mode, tag, query, author, period, sort]);
    const cachedOnMount = useRef(readSnapshot(snapshotKey));
    const [posts, setPosts] = useState(() => cachedOnMount.current?.posts || []);
    const [loading, setLoading] = useState(() => !cachedOnMount.current);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextPage, setNextPage] = useState(() => cachedOnMount.current?.nextPage ?? null);
    const [hasMore, setHasMore] = useState(() => cachedOnMount.current?.hasMore ?? true);
    const [error, setError] = useState('');
    const [composeOpen, setComposeOpen] = useState(false);
    const [compact, setCompact] = useLocalStorage('mrr_feed_compact', false);

    const sentinelRef = useRef(null);
    const scrollRef = useRef(null);
    const currentFeedRef = useRef(null);
    currentFeedRef.current = { posts, nextPage, hasMore };
    const currentKeyRef = useRef(snapshotKey);
    const lastScrollYRef = useRef(cachedOnMount.current?.scrollY ?? 0);
    const lastAnchorRef = useRef(cachedOnMount.current?.anchor ?? null);
    const feedItemsRef = useRef(null);

    const capturePosition = useCallback(() => {
        lastScrollYRef.current = window.scrollY;
        const items = feedItemsRef.current?.querySelectorAll('[data-feed-post-id]');
        if (!items?.length) return;
        const topEdge = 0;
        let selected = null;
        for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (rect.bottom > topEdge + 1) { selected = { id: item.dataset.feedPostId, offset: rect.top - topEdge }; break; }
        }
        if (selected) lastAnchorRef.current = selected;
    }, []);

    const persistPosition = useCallback(() => {
        capturePosition();
        const state = currentFeedRef.current;
        if (state?.posts.length) {
            saveSnapshot(currentKeyRef.current, { ...state, scrollY: lastScrollYRef.current, anchor: lastAnchorRef.current });
        }
    }, [capturePosition]);
    const restoreYRef = useRef(cachedOnMount.current?.scrollY ?? null);
    const restorePendingRef = useRef(restoreYRef.current !== null);

    // Record scroll position while the feed is visible, not during unmount:
    // iOS Safari can reset document scroll before effect cleanups run.
    useEffect(() => {
        const onScroll = () => {
            if (!restorePendingRef.current) capturePosition();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [capturePosition]);

    useEffect(() => {
        const key = snapshotKey;
        return () => {
            if (currentKeyRef.current !== key) return;
            const state = currentFeedRef.current;
            if (state?.posts.length) {
                saveSnapshot(key, { ...state, scrollY: lastScrollYRef.current, anchor: lastAnchorRef.current });
            }
        };
    }, [snapshotKey]);

    // Prefer a post anchor to an absolute pixel position: images and WebKit's
    // deferred off-screen painting can change the height of preceding cards.
    useLayoutEffect(() => {
        if (restoreYRef.current === null) return;
        const y = restoreYRef.current;
        const anchor = cachedOnMount.current?.anchor || lastAnchorRef.current;
        let frame1 = null;
        let frame2 = null;
        const restore = () => {
            const node = Array.from(feedItemsRef.current?.querySelectorAll('[data-feed-post-id]') || [])
                .find((item) => item.dataset.feedPostId === anchor?.id);
            if (node) {
                const topEdge = 0;
                const delta = node.getBoundingClientRect().top - topEdge - anchor.offset;
                window.scrollTo(0, Math.max(0, window.scrollY + delta));
            } else {
                window.scrollTo(0, y);
            }
        };
        frame1 = requestAnimationFrame(() => {
            frame2 = requestAnimationFrame(() => {
                restore();
                restorePendingRef.current = false;
                restoreYRef.current = null;
                capturePosition();
            });
        });
        return () => {
            if (frame1 !== null) cancelAnimationFrame(frame1);
            if (frame2 !== null) cancelAnimationFrame(frame2);
        };
    }, [capturePosition]);

    const feedUrl = useCallback((page) => `/feed2/posts?limit=${PAGE_SIZE}&page=${page}&mode=${encodeURIComponent(mode)}${query ? `&q=${encodeURIComponent(query)}` : ''}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}${author ? `&author=${encodeURIComponent(author)}` : ''}&period=${encodeURIComponent(period)}&sort=${encodeURIComponent(sort)}`, [mode, query, tag, author, period, sort]);
    const changeFilters = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setParams(next); };
    useEffect(() => { setSearchDraft(query); }, [query]);
    useEffect(() => { setAuthorDraft(author); }, [author]);
    useEffect(() => {
        if (!filtersOpen || !token || authorDraft.trim().replace(/^@/, '').length < 2) {
            setAuthorSuggestions([]);
            return;
        }
        let active = true;
        const timer = setTimeout(() => {
            api(`/feed2/authors?q=${encodeURIComponent(authorDraft.trim().replace(/^@/, ''))}`, { token })
                .then((items) => { if (active) setAuthorSuggestions(items); })
                .catch(() => { if (active) setAuthorSuggestions([]); });
        }, 250);
        return () => { active = false; clearTimeout(timer); };
    }, [authorDraft, filtersOpen, token]);
    useEffect(() => { if (!token) return; api('/feed2/tags', { token }).then(setTrending).catch(() => {}); }, [token]);

    useEffect(() => {
        if (!token || !linkedPostId) { setLinkedPost(null); setLinkedError(''); return; }
        let active = true;
        setLinkedPost(null);
        setLinkedError('');
        api(`/feed2/posts/${encodeURIComponent(linkedPostId)}`, { token })
            .then((item) => { if (active) setLinkedPost(item); })
            .catch((error) => { if (active) setLinkedError(error.message || 'Публикация недоступна'); });
        return () => { active = false; };
    }, [token, linkedPostId]);

    useEffect(() => {
        if (!token || !linkedPostId || !linkedCommentId) {
            setFocusedComment(null);
            setFocusedCommentStatus('');
            return;
        }
        let active = true;
        setFocusedComment(null);
        setFocusedCommentStatus('loading');
        api('/posts/' + encodeURIComponent(linkedPostId) + '/comments', { token })
            .then((tree) => {
                if (!active) return;
                const find = (items) => {
                    for (const item of items || []) {
                        if (String(item.id) === String(linkedCommentId)) return item;
                        const nested = find(item.replies);
                        if (nested) return nested;
                    }
                    return null;
                };
                const found = find(tree);
                setFocusedComment(found);
                setFocusedCommentStatus(found ? 'found' : 'missing');
            })
            .catch(() => { if (active) setFocusedCommentStatus('error'); });
        return () => { active = false; };
    }, [token, linkedPostId, linkedCommentId]);

    /* Первичная загрузка */
    const loadInitial = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const r = await api(feedUrl(0), { token });
            setPosts(r.items);
            setNextPage(r.nextPage);
            setHasMore(r.nextPage !== null);
        } catch (e) {
            setError(e.message || 'Не удалось загрузить ленту');
        } finally {
            setLoading(false);
        }
    }, [token, feedUrl]);

    useEffect(() => {
        if (cachedOnMount.current && currentKeyRef.current === snapshotKey) {
            cachedOnMount.current = null;
            return;
        }
        currentKeyRef.current = snapshotKey;
        lastScrollYRef.current = 0;
        lastAnchorRef.current = null;
        restorePendingRef.current = false;
        restoreYRef.current = null;
        setPosts([]);
        setNextPage(null);
        setHasMore(true);
        window.scrollTo({ top: 0, behavior: 'instant' });
        loadInitial();
    }, [loadInitial, snapshotKey]);

    /* Подгрузка следующей страницы */
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || nextPage === null || !token) return;
        setLoadingMore(true);
        try {
            const r = await api(feedUrl(nextPage), { token });
            setPosts((prev) => [...prev, ...r.items]);
            setNextPage(r.nextPage);
            setHasMore(r.nextPage !== null);
        } catch (e) {
            setError(e.message || 'Не удалось подгрузить');
        } finally {
            setLoadingMore(false);
        }
    }, [nextPage, hasMore, loadingMore, token, feedUrl]);

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
        <div ref={scrollRef} className="ui-feed-page" onClickCapture={(event) => {
            if (event.target.closest('a[href^="/app/"]')) persistPosition();
        }}>
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
            <div className="rounded-2xl border border-white/10 bg-white/[.035] p-3 sm:p-4 space-y-4 mb-5">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Разделы ленты">
                    {[['latest', '🕒 Новые'], ['recommended', '✨ Рекомендуем'], ['saved', '🔖 Сохранённые'], ['mine', '👤 Мои']].map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === key ? 'bg-violet-500/25 text-violet-100 border border-violet-400/30' : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10'}`} onClick={() => changeFilters({ mode: key === 'latest' ? '' : key })}>{label}</button>)}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <button type="button" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10 transition" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="feed-advanced-filters">
                        <span aria-hidden="true">⌕</span> Поиск и фильтры
                        {hasActiveFilters && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-500">Активны</span>}
                        <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
                    </button>
                    {hasActiveFilters && !filtersOpen && <button type="button" className="text-xs underline text-white/60" onClick={() => { setSearchDraft(''); setAuthorDraft(''); changeFilters({ q: '', author: '', tag: '', period: '', sort: '' }); }}>Сбросить</button>}
                </div>
                {filtersOpen && <div id="feed-advanced-filters" className="space-y-3 pt-2 border-t border-white/10">
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); changeFilters({ q: searchDraft.trim(), author: authorDraft.trim().replace(/^@/, '') }); }}>
                    <input aria-label="Поиск по публикациям и авторам" className="input flex-1 min-w-0" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Поиск по тексту, авторам, темам…" maxLength={100} />
                    <button type="submit" className="btn-primary shrink-0">Найти</button>
                    {query && <button type="button" className="btn-ghost" onClick={() => { setSearchDraft(''); changeFilters({ q: '' }); }} aria-label="Очистить поиск">✕</button>}
                </form>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="text-xs text-white/60 space-y-1">Автор (@username)
                        <input className="input w-full" aria-label="Фильтр по автору" value={authorDraft} onChange={(e) => setAuthorDraft(e.target.value)} maxLength={60} placeholder="Начните вводить имя или @username" autoComplete="off" />
                        {authorSuggestions.length > 0 && <div className="mt-1 rounded-xl border border-white/10 bg-white/5 p-1 max-h-48 overflow-auto" role="listbox" aria-label="Подходящие авторы">
                            {authorSuggestions.map((item) => <button type="button" role="option" aria-selected={author === item.username} key={item.id} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-violet-500/15 transition" onClick={() => { setAuthorDraft(item.username); setAuthorSuggestions([]); changeFilters({ author: item.username }); }}>
                                <span className="block text-sm font-semibold">{item.fullName}</span>
                                <span className="block text-xs opacity-60">@{item.username}</span>
                            </button>)}
                        </div>}
                    </label>
                    <label className="text-xs text-white/60 space-y-1">Период
                        <select className="input w-full" aria-label="Период публикаций" value={period} onChange={(e) => changeFilters({ period: e.target.value === 'all' ? '' : e.target.value })}>
                            <option value="all">За всё время</option><option value="7d">За 7 дней</option><option value="30d">За 30 дней</option><option value="90d">За 90 дней</option>
                        </select>
                    </label>
                    <label className="text-xs text-white/60 space-y-1">Сортировка
                        <select className="input w-full" aria-label="Сортировка публикаций" value={sort} onChange={(e) => changeFilters({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
                            <option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="popular">По реакциям</option>
                        </select>
                    </label>
                </div>
                {(query || author || tag || period !== 'all' || sort !== 'newest') && <button type="button" className="text-xs underline text-white/60" onClick={() => { setSearchDraft(''); setAuthorDraft(''); changeFilters({ q: '', author: '', tag: '', period: '', sort: '' }); }}>Сбросить все фильтры</button>}
                {tag && <div className="flex items-center gap-3"><span className="text-sm text-violet-200"># {tag}</span><button type="button" className="text-xs underline text-white/60" onClick={() => changeFilters({ tag: '' })}>Сбросить хештег</button></div>}
                {trending.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-white/40 mr-1">Популярные темы</span>{trending.map(({ tag: t, count }) => <button type="button" key={t} className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-violet-200 hover:bg-white/10" onClick={() => changeFilters({ tag: t })}>#{t} <span className="text-white/35">{count}</span></button>)}</div>}
                </div>}
            </div>
            <button type="button" className="ui-feed-compose" onClick={() => setComposeOpen((v) => !v)} aria-expanded={composeOpen} aria-controls="feed-composer"><Icon name="plus" size={19} /> Новая публикация <Icon name="chevronRight" size={16} /></button>
            {composeOpen && <PostComposer onClose={() => setComposeOpen(false)} onPublished={() => { setComposeOpen(false); return loadInitial(); }} />}

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
                    {mode === 'saved' ? 'Вы ещё не сохранили ни одной публикации.' : mode === 'mine' ? 'Вы ещё не опубликовали ни одной записи.' : query || tag ? 'По вашему запросу публикаций не найдено.' : mode === 'recommended' ? 'Пока нет публикаций для рекомендаций за последние 30 дней.' : 'Пока нет публикаций. Создайте первую запись у себя в профиле.'}
                </div>
            )}

            {mode === 'saved' && !loading && posts.length > 0 && <p className="text-sm opacity-65 mb-3">{sort === 'newest' ? 'Сначала недавно сохранённые' : sort === 'oldest' ? 'Сначала старые публикации' : 'Сначала публикации с большим числом реакций'}</p>}
            {linkedPostId && <section className="mb-5 rounded-2xl border border-violet-400/30 p-3 sm:p-4" aria-label="Публикация по ссылке">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="font-semibold text-sm">🔗 Публикация по ссылке</span>
                    <button type="button" className="text-xs underline opacity-70" onClick={() => changeFilters({ post: '', comment: '' })}>Закрыть</button>
                </div>
                {linkedError && <p role="alert" className="text-sm opacity-70">{linkedError}</p>}
                {!linkedPost && !linkedError && <p className="text-sm opacity-60">Загружаем публикацию…</p>}
                {linkedPost && linkedCommentId && (
                    <div className="mb-4 rounded-2xl border-2 border-violet-400/60 bg-violet-500/10 p-4" role="region" aria-label="Комментарий из уведомления">
                        <div className="font-semibold text-sm mb-2">💬 Комментарий, в котором вас упомянули</div>
                        {focusedCommentStatus === 'loading' && <div className="text-sm opacity-60">Загружаем комментарий…</div>}
                        {focusedCommentStatus === 'found' && focusedComment && (
                            <>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-sm font-semibold">{focusedComment.author?.fullName || 'Участник'}</span>
                                    <span className="text-xs opacity-60">{focusedComment.createdAt ? new Date(focusedComment.createdAt).toLocaleString('ru-RU') : ''}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">{focusedComment.content}</p>
                                <div className="text-xs opacity-60 mt-2">Полная ветка обсуждения находится ниже.</div>
                            </>
                        )}
                        {focusedCommentStatus === 'missing' && <p className="text-sm opacity-60">Комментарий удалён или больше недоступен.</p>}
                        {focusedCommentStatus === 'error' && <p className="text-sm opacity-60">Не удалось загрузить комментарий. Обновите страницу.</p>}
                    </div>
                )}
                {linkedPost && <PostCard post={linkedPost} author={linkedPost.author} compact={compact} onTagClick={(value) => changeFilters({ tag: value, post: '' })} highlightCommentId={linkedCommentId} onChanged={(u) => setLinkedPost((prev) => ({ ...prev, ...u }))} onDeleted={() => { setLinkedPost(null); changeFilters({ post: '' }); }} onReposted={loadInitial} />}
            </section>}
            <div ref={feedItemsRef} className={`ui-feed-posts ${compact ? 'space-y-2' : 'space-y-4'}`}>
                {posts.map((post) => (
                    <div key={post.id} data-feed-post-id={post.id} className="mrr-feed-item">
                    {mode === 'saved' && post.savedAt && <div className="text-xs opacity-60 mb-2 px-2">🔖 Сохранено {new Date(post.savedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                    <PostCard
                        post={post}
                        author={post.author}
                        compact={compact}
                        onTagClick={(value) => changeFilters({ tag: value })}
                        onReposted={loadInitial}
                        onChanged={(u) => setPosts((prev) => mode === 'saved' && u.isSaved === false ? prev.filter((x) => x.id !== u.id) : prev.map((x) => x.id === u.id ? { ...x, ...u } : x))}
                        onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
                    />
                    </div>
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