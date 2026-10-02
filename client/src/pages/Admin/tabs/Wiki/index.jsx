import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
import ArticleEditor from './ArticleEditor.jsx';
import CategoryEditor from './CategoryEditor.jsx';

export default function Wiki({ token }) {
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [editingCat, setEditingCat] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const reload = async () => {
        try {
            const [c, a] = await Promise.all([
                api('/admin/wiki/categories', { token }),
                api(`/admin/wiki/articles${activeCategory ? `?category=${activeCategory}` : ''}`, { token }),
            ]);
            setCategories(c);
            setArticles(a);
        } catch (e) { setError(e.message); }
    };

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [token, activeCategory]);

    const seedDefaults = async () => {
        if (!confirm('Загрузить стартовые категории и статьи?')) return;
        setBusy(true); setError('');
        try {
            const r = await api('/admin/wiki/seed-defaults', { method: 'POST', token });
            alert(`Загружено: категорий ${r.categoriesCreated}, статей ${r.articlesCreated}`);
            await reload();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const removeCategory = async (id) => {
        if (!confirm('Удалить категорию?')) return;
        try {
            await api(`/admin/wiki/categories/${id}`, { method: 'DELETE', token });
            await reload();
        } catch (e) { alert(e.message); }
    };

    const removeArticle = async (id) => {
        if (!confirm('Удалить статью?')) return;
        try {
            await api(`/admin/wiki/articles/${id}`, { method: 'DELETE', token });
            await reload();
        } catch (e) { alert(e.message); }
    };

    const filteredArticles = articles.filter((a) =>
        !search || a.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <div className="font-bold text-lg">📖 База знаний «ВикиМедиа»</div>
                        <div className="text-sm text-white/50 mt-1">Категории и статьи для раздела у студентов.</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={seedDefaults} disabled={busy} className="btn-ghost">{busy ? '⏳…' : '🌱 Стартовые'}</button>
                        <button onClick={() => setEditingCat({ mode: 'create' })} className="btn-ghost">＋ Категория</button>
                        <button onClick={() => setEditing({ mode: 'create' })} className="btn-primary">＋ Статья</button>
                    </div>
                </div>

                {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3 mb-3">{error}</div>}

                <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => setActiveCategory('')} className={`chip ${!activeCategory ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>Все статьи</button>
                    {categories.map((c) => (
                        <div key={c.id} className="flex items-center gap-1">
                            <button onClick={() => setActiveCategory(c.slug)} className={`chip ${activeCategory === c.slug ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>
                                {c.icon} {c.title} ({c.articlesCount})
                            </button>
                            <button onClick={() => setEditingCat({ mode: 'edit', data: c })} className="text-xs text-white/40 hover:text-white px-1">✏️</button>
                            <button onClick={() => removeCategory(c.id)} className="text-xs text-white/40 hover:text-pink px-1">✕</button>
                        </div>
                    ))}
                </div>

                <input className="input" placeholder="Поиск по статьям…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="card divide-y divide-white/5">
                {filteredArticles.length === 0 && <div className="p-6 text-center text-white/40">Статей нет</div>}
                {filteredArticles.map((a) => (
                    <div key={a.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="text-2xl">{a.category?.icon || '📄'}</div>
                        <div className="flex-1 min-w-[220px]">
                            <div className="font-bold">{a.title}</div>
                            <div className="text-xs text-white/40">
                                /{a.slug}
                                {a.category && ` · ${a.category.title}`}
                                {' · '}
                                <span className={a.published ? 'text-lime' : 'text-orange-300'}>
                                    {a.published ? 'опубликована' : 'черновик'}
                                </span>
                                {' · '}👁 {a.views}
                            </div>
                        </div>
                        <button onClick={() => setEditing({ mode: 'edit', data: a })} className="chip bg-violet/30 hover:bg-violet/50">✏️</button>
                        <button onClick={() => removeArticle(a.id)} className="chip bg-white/5 hover:bg-pink/30">🗑️</button>
                    </div>
                ))}
            </div>

            {editing && (
                <ArticleEditor
                    token={token}
                    initial={editing.data}
                    isNew={editing.mode === 'create'}
                    categories={categories}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await reload(); }}
                />
            )}

            {editingCat && (
                <CategoryEditor
                    token={token}
                    initial={editingCat.data}
                    isNew={editingCat.mode === 'create'}
                    onClose={() => setEditingCat(null)}
                    onSaved={async () => { setEditingCat(null); await reload(); }}
                />
            )}
        </div>
    );
}