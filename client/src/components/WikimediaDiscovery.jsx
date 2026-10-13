import { useEffect, useState } from 'react';

const ENDPOINT = 'https://ru.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&grnlimit=1&prop=extracts%7Cpageimages&exintro=1&explaintext=1&exsentences=4&pithumbsize=480&format=json&origin=*';

export default function WikimediaDiscovery() {
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        // Dashboard is unmounted on navigation. Every new visit fetches a new random article.
        const controller = new AbortController();
        setLoading(true);
        fetch(ENDPOINT, { signal: controller.signal, cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error('Википедия недоступна');
                return res.json();
            })
            .then(data => {
                const page = Object.values(data?.query?.pages || {})[0];
                if (!page?.title || !page?.pageid) throw new Error('Нет статьи');
                setArticle({
                    title: page.title,
                    summary: page.extract || 'Узнайте больше об этой теме в Википедии.',
                    image: page.thumbnail?.source || null,
                    url: 'https://ru.wikipedia.org/?curid=' + encodeURIComponent(page.pageid),
                });
                setError(false);
            })
            .catch(err => { if (err.name !== 'AbortError') setError(true); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);
    return <section className="ui-section" aria-label="Случайная статья из Википедии">
        <div className="ui-section-head">
            <div>
                <div className="ui-section-title">Открой что-то новое</div>
                <div className="ui-card2__muted">Случайная статья из Википедии · новая при каждом посещении главной</div>
            </div>
            <a className="ui-section-link" href="https://ru.wikipedia.org/" target="_blank" rel="noopener noreferrer">Википедия ↗</a>
        </div>
        <div className="ui-card2">
            {loading ? <div role="status" className="py-8 text-sm opacity-60">Подбираем интересную статью…</div>
                : error ? <div className="space-y-2 py-3">
                    <p className="text-sm opacity-75">Не удалось загрузить статью. Википедия может быть временно недоступна.</p>
                    <a className="ui-section-link" target="_blank" rel="noopener noreferrer" href="https://ru.wikipedia.org/wiki/Служебная:Случайная_страница">Открыть случайную статью ↗</a>
                  </div>
                : <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)] items-start">
                    <div className="min-w-0">
                        <p className="text-xs text-violet-soft font-semibold mb-2">WIKIPEDIA · СЛУЧАЙНАЯ СТАТЬЯ</p>
                        <h3 className="text-lg sm:text-xl font-bold break-words">{article.title}</h3>
                        <p className="text-sm opacity-75 mt-3 leading-relaxed whitespace-pre-line break-words line-clamp-6">{article.summary}</p>
                        <a className="ui-section-link inline-flex mt-4" href={article.url} target="_blank" rel="noopener noreferrer">Читать статью целиком ↗</a>
                    </div>
                    {article.image && <img src={article.image} alt="" loading="lazy" className="w-full max-h-48 object-cover rounded-xl border border-white/10" />}
                  </div>}
            <div className="mt-4 pt-3 border-t border-white/10 text-xs opacity-50">Материал и изображения предоставлены Википедией / участниками Wikimedia. Доступность зависит от внешнего сервиса.</div>
        </div>
    </section>;
}
