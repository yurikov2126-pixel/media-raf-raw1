import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function WikimediaDiscovery() {
    const { token } = useAuth();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Fetch on each dashboard mount, not from an external encyclopedia.
        let active = true;
        setLoading(true);
        setArticle(null);
        setError(false);
        api('/wiki/random', { token })
            .then(data => { if (active) setArticle(data); })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token]);

    return <section className="ui-section" aria-label="Случайная статья ВикиМедиа">
        <div className="ui-section-head">
            <div>
                <div className="ui-section-title">Открой что-то новое</div>
                <div className="ui-card2__muted">Случайная статья из нашей ВикиМедиа · новая при каждом открытии главной</div>
            </div>
            <Link className="ui-section-link" to="/app/wiki">ВикиМедиа →</Link>
        </div>
        <div className="ui-card2">
            {loading ? <div role="status" className="py-8 text-sm opacity-60">Выбираем статью из ВикиМедиа…</div>
                : error ? <div className="space-y-2 py-3">
                    <p role="alert" className="text-sm opacity-75">Не удалось загрузить статью из базы знаний.</p>
                    <Link className="ui-section-link" to="/app/wiki">Перейти в ВикиМедиа →</Link>
                  </div>
                : !article ? <div className="space-y-2 py-3">
                    <p className="text-sm opacity-75">В ВикиМедиа пока нет опубликованных статей.</p>
                    <Link className="ui-section-link" to="/app/wiki">Открыть базу знаний →</Link>
                  </div>
                : <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)] items-start">
                    <div className="min-w-0">
                        <p className="text-xs text-violet-soft font-semibold mb-2">{article.category?.icon || '📚'} ВИКИМЕДИА · {article.category?.title || 'БАЗА ЗНАНИЙ'}</p>
                        <h3 className="text-lg sm:text-xl font-bold break-words">{article.title}</h3>
                        <p className="text-sm opacity-75 mt-3 leading-relaxed whitespace-pre-line break-words line-clamp-6">
                            {article.excerpt || 'Узнай больше об этой теме в нашей базе знаний.'}
                        </p>
                        <Link className="ui-section-link inline-flex mt-4" to={`/app/wiki/${encodeURIComponent(article.slug)}`}>Читать статью →</Link>
                    </div>
                    {article.cover && <img src={resolveUrl(article.cover)} alt="" loading="lazy" className="w-full max-h-48 object-cover rounded-xl border border-white/10" />}
                  </div>}
            <div className="mt-4 pt-3 border-t border-white/10 text-xs opacity-50">Материалы внутренней базы знаний Media_РАФ_RAW.</div>
        </div>
    </section>;
}
