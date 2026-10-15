import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

export default function Wiki() {
    const { token } = useAuth();
    const [params, setParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const articleListRef = useRef(null);
    const scrollAfterCategory = useRef(false);
    const [articles, setArticles] = useState([]);
    const [popular, setPopular] = useState([]);
    const [myArticles, setMyArticles] = useState([]);
    const [myTab, setMyTab] = useState('bookmarks');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState(params.get('q') || '');

    const [search, setSearch] = useState(params.get('q') || '');
    const activeCategory = params.get('cat') || '';

    useEffect(() => {
        if (!token) return;
        api('/wiki/me', { token }).then(setMyArticles).catch(() => {});
        Promise.all([
            api('/wiki/categories', { token }).catch(() => []),
            api('/wiki/popular', { token }).catch(() => []),
        ]).then(([c, p]) => {
            setCategories(c);
            setPopular(p);
        });
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => { setPage(1); }, [activeCategory, debouncedSearch]);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        setLoading(true);
        const qs = new URLSearchParams();
        if (activeCategory) qs.set('category', activeCategory);
        if (debouncedSearch.trim()) qs.set('q', debouncedSearch.trim());
        qs.set('page', String(page));
        qs.set('limit', '24');
        const url = `/wiki/articles${qs.toString() ? `?${qs}` : ''}`;
        api(url, { token })
            .then((result) => { if (!cancelled) { setArticles(result.items || []); setTotal(result.total || 0); } })
            .catch(() => { if (!cancelled) { setArticles([]); setTotal(0); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token, activeCategory, debouncedSearch, page]);

    useEffect(() => {
        if (!loading && scrollAfterCategory.current) {
            scrollAfterCategory.current = false;
            requestAnimationFrame(() => articleListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    }, [loading, activeCategory]);

    const selectCategory = (value) => {
        scrollAfterCategory.current = true;
        if (activeCategory === value) {
            articleListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            updateParam('cat', value);
        }
    };

    const updateParam = (key, value) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const onSearch = (e) => {
        e.preventDefault();
        updateParam('q', search.trim());
    };

    const groupedArticles = useMemo(() => {
        if (activeCategory) return null;
        const map = new Map();
        for (const a of articles) {
            const key = a.category?.slug || 'без-категории';
            if (!map.has(key)) map.set(key, { category: a.category, list: [] });
            map.get(key).list.push(a);
        }
        return Array.from(map.entries()).map(([key, v]) => ({
            slug: key,
            title: v.category?.title || 'Без категории',
            icon: v.category?.icon || '📄',
            articles: v.list,
        }));
    }, [articles, activeCategory]);

    usePageMeta({
        title: activeCategory
            ? (categories.find((c) => c.slug === activeCategory)?.title || 'ВикиМедиа')
            : 'ВикиМедиа',
        description: 'База знаний медиацентра: термины, приёмы, оборудование и правила.',
    });

    return (
        <div className="wiki-page w-full min-w-0 max-w-7xl mx-auto overflow-x-clip p-4 md:p-10">
            {/* Заголовок */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="text-4xl">📚</div>
                    <h1 className="text-3xl md:text-5xl font-bold">ВикиМедиа</h1>
                </div>
                <p className="text-white/50">
                    База знаний медиацентра: термины, приёмы, оборудование и правила.
                </p>
            </div>

            {/* Поиск */}
            <form onSubmit={onSearch} className="mb-5 flex min-w-0 gap-2">
                <input
                    className="input min-w-0 flex-1"
                    placeholder="Поиск по базе знаний…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn-primary !px-5">🔍</button>
            </form>

            {/* Персональная подборка */}
            <section className="card p-4 mb-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="font-semibold">Моя ВикиМедиа</h2>
                    <div className="flex gap-2">
                        <button className={myTab === 'bookmarks' ? 'btn-primary !px-3 !py-2 text-xs' : 'btn-ghost !px-3 !py-2 text-xs'} onClick={() => setMyTab('bookmarks')}>★ Закладки</button>
                        <button className={myTab === 'recent' ? 'btn-primary !px-3 !py-2 text-xs' : 'btn-ghost !px-3 !py-2 text-xs'} onClick={() => setMyTab('recent')}>◷ История</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {myArticles.filter(item => myTab === 'bookmarks' ? item.bookmarked : !!item.lastReadAt).slice(0, 12).map(item => (
                        <Link key={item.id} to={`/app/wiki/${item.article.slug}`} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm max-w-full break-words">
                            {item.article.title}
                        </Link>
                    ))}
                    {myArticles.filter(item => myTab === 'bookmarks' ? item.bookmarked : !!item.lastReadAt).length === 0 && (
                        <p className="text-sm text-white/50">Здесь появятся ваши сохранённые и прочитанные статьи.</p>
                    )}
                </div>
            </section>
            {/* Категории */}
            <div className="grid min-w-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                <button
                    onClick={() => selectCategory('')}
                    className={`rounded-2xl p-4 text-left border transition ${!activeCategory ? 'bg-violet/20 border-violet' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                    📖 Все статьи
                </button>
                {categories.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => selectCategory(c.slug)}
                        className={`rounded-2xl p-4 text-left border transition ${
                            activeCategory === c.slug
                                ? 'bg-violet/20 border-violet'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                    >
                        <span className="block text-2xl mb-2">{c.icon}</span><span className="block font-semibold text-sm">{c.title}</span><span className="text-xs opacity-60">{c.articlesCount} статей</span>
                    </button>
                ))}
            </div>

            <div ref={articleListRef} className="grid min-w-0 grid-cols-1 lg:grid-cols-4 gap-6 scroll-mt-6">
                {/* Основной список */}
                <div className="lg:col-span-4 text-lg font-semibold">{activeCategory ? (categories.find(c => c.slug === activeCategory)?.title || "Статьи категории") : "Все материалы"}</div>
                <div className="min-w-0 lg:col-span-3 space-y-4">
                    {loading && (
                        <div className="card p-8 text-center text-white/40">Загрузка…</div>
                    )}

                    {!loading && articles.length === 0 && (
                        <div className="card p-8 text-center text-white/40">
                            Ничего не найдено. Попробуйте изменить запрос или категорию.
                        </div>
                    )}

                    {!loading && activeCategory && (
                        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                            {articles.map((a) => (
                                <ArticleCard key={a.id} article={a} />
                            ))}
                        </div>
                    )}

                    {!loading && !activeCategory && groupedArticles && (
                        <div className="min-w-0 space-y-8">
                            {groupedArticles.map((g) => (
                                <div key={g.slug}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">{g.icon}</span>
                                        <h2 className="text-xl font-bold">{g.title}</h2>
                                    </div>
                                    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                                        {g.articles.map((a) => (
                                            <ArticleCard key={a.id} article={a} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Сайдбар: популярное */}
                <aside className="min-w-0 lg:col-span-1 space-y-4">
                    <div className="card p-5">
                        <div className="font-bold mb-3 flex items-center gap-2">
                            🔥 Популярное
                        </div>
                        {popular.length === 0 && (
                            <div className="text-xs text-white/40">Пока нет статей</div>
                        )}
                        <div className="space-y-2">
                            {popular.map((a) => (
                                <Link
                                    key={a.id}
                                    to={`/app/wiki/${a.slug}`}
                                    className="block p-2 rounded-xl hover:bg-white/5 transition"
                                >
                                    <div className="text-sm font-semibold truncate">{a.title}</div>
                                    <div className="text-[10px] text-white/40">
                                        {a.views} просмотров
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="card p-5">
                        <div className="font-bold mb-3">📊 Статистика</div>
                        <div className="text-sm text-white/60 space-y-1">
                            <div>Категорий: <b className="text-white">{categories.length}</b></div>
                            <div>Всего статей: <b className="text-white">{total}</b></div>
                        </div>
                    </div>
                </aside>
            </div>
            {total > 24 && <div className="flex justify-center items-center gap-3 mt-6"><button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Назад</button><span className="text-sm text-white/60">{page} / {Math.ceil(total / 24)}</span><button className="btn-ghost" disabled={page * 24 >= total} onClick={() => setPage((p) => p + 1)}>Далее →</button></div>}
        </div>
    );
}

function ArticleCard({ article }) {
    return (
        <Link
            to={`/app/wiki/${article.slug}`}
            className="card block min-w-0 max-w-full overflow-hidden transition hover:-translate-y-0.5 group"
        >
            {article.cover && <img src={article.cover} alt="" loading="lazy" className="w-full h-36 object-cover" />}
            <div className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
                <div className="text-2xl shrink-0">
                    {article.category?.icon || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg mb-1 break-words [overflow-wrap:anywhere] group-hover:text-violet-soft transition">
                        {article.title}
                    </div>
                    {article.excerpt && (
                        <div className="text-sm text-white/60 line-clamp-2 mb-2 break-words [overflow-wrap:anywhere]">
                            {article.excerpt}
                        </div>
                    )}
                    <div className="flex min-w-0 flex-wrap gap-2 items-center text-xs text-white/40">
                        {article.category && (
                            <span className="chip max-w-full whitespace-normal break-words [overflow-wrap:anywhere] bg-white/5 text-white/60">
                {article.category.title}
              </span>
                        )}
                        {(article.tags || []).slice(0, 3).map((t) => (
                            <span key={t} className="chip max-w-full whitespace-normal break-words [overflow-wrap:anywhere] bg-white/5 text-white/50">
                #{t}
              </span>
                        ))}
                        <span className="block w-full min-w-0 break-words text-left sm:ml-auto sm:w-auto sm:text-right">
              👁 {article.views} · {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
            </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}