import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function Wiki() {
    const { token } = useAuth();
    const [params, setParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [popular, setPopular] = useState([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState(params.get('q') || '');
    const activeCategory = params.get('cat') || '';

    useEffect(() => {
        if (!token) return;
        Promise.all([
            api('/wiki/categories', { token }).catch(() => []),
            api('/wiki/popular', { token }).catch(() => []),
        ]).then(([c, p]) => {
            setCategories(c);
            setPopular(p);
        });
    }, [token]);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        const qs = new URLSearchParams();
        if (activeCategory) qs.set('category', activeCategory);
        if (search.trim()) qs.set('q', search.trim());
        const url = `/wiki/articles${qs.toString() ? `?${qs}` : ''}`;
        api(url, { token })
            .then(setArticles)
            .catch(() => setArticles([]))
            .finally(() => setLoading(false));
    }, [token, activeCategory, search]);

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

    return (
        <div className="p-4 md:p-10 max-w-6xl mx-auto">
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
            <form onSubmit={onSearch} className="mb-5 flex gap-2">
                <input
                    className="input flex-1"
                    placeholder="Поиск по базе знаний…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn-primary !px-5">🔍</button>
            </form>

            {/* Категории */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => updateParam('cat', '')}
                    className={`chip ${!activeCategory ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                >
                    📖 Все статьи
                </button>
                {categories.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => updateParam('cat', c.slug)}
                        className={`chip ${
                            activeCategory === c.slug
                                ? 'bg-violet text-white'
                                : 'bg-white/5 text-white/60'
                        }`}
                    >
                        {c.icon} {c.title} ({c.articlesCount})
                    </button>
                ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Основной список */}
                <div className="md:col-span-2 space-y-4">
                    {loading && (
                        <div className="card p-8 text-center text-white/40">Загрузка…</div>
                    )}

                    {!loading && articles.length === 0 && (
                        <div className="card p-8 text-center text-white/40">
                            Ничего не найдено. Попробуйте изменить запрос или категорию.
                        </div>
                    )}

                    {!loading && activeCategory && (
                        <div className="space-y-3">
                            {articles.map((a) => (
                                <ArticleCard key={a.id} article={a} />
                            ))}
                        </div>
                    )}

                    {!loading && !activeCategory && groupedArticles && (
                        <div className="space-y-8">
                            {groupedArticles.map((g) => (
                                <div key={g.slug}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">{g.icon}</span>
                                        <h2 className="text-xl font-bold">{g.title}</h2>
                                    </div>
                                    <div className="space-y-3">
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
                <aside className="md:col-span-1 space-y-4">
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
                            <div>Статей: <b className="text-white">{articles.length}</b></div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function ArticleCard({ article }) {
    return (
        <Link
            to={`/app/wiki/${article.slug}`}
            className="card p-5 block hover:-translate-y-0.5 transition group"
        >
            <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">
                    {article.category?.icon || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg mb-1 group-hover:text-violet-soft transition">
                        {article.title}
                    </div>
                    {article.excerpt && (
                        <div className="text-sm text-white/60 line-clamp-2 mb-2">
                            {article.excerpt}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-center text-xs text-white/40">
                        {article.category && (
                            <span className="chip bg-white/5 text-white/60">
                {article.category.title}
              </span>
                        )}
                        {article.tags.slice(0, 3).map((t) => (
                            <span key={t} className="chip bg-white/5 text-white/50">
                #{t}
              </span>
                        ))}
                        <span className="ml-auto">
              👁 {article.views} · {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
            </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}