import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import MarkdownView from '../components/MarkdownView.jsx';

export default function WikiArticle() {
    const { slug } = useParams();
    const { token, user } = useAuth();
    const nav = useNavigate();
    const [article, setArticle] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError('');
        api(`/wiki/articles/${slug}`, { token })
            .then(setArticle)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        window.scrollTo({ top: 0 });
    }, [slug, token]);

    usePageMeta({
        title: article ? article.title : 'База знаний',
        description: article?.excerpt || 'Статья из базы знаний MEDIA·RAF·RAW',
        image: article?.cover,
        type: 'article',
    });

    if (loading) {
        return <div className="p-10 text-center text-white/40">Загрузка…</div>;
    }
    if (error || !article) {
        return (
            <div className="p-10 text-center">
                <div className="text-5xl mb-3">🔍</div>
                <div className="text-xl font-bold mb-2">Статья не найдена</div>
                <div className="text-white/50 mb-6">{error || 'Такой статьи нет'}</div>
                <button onClick={() => nav('/app/wiki')} className="btn-primary">
                    ← В базу знаний
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-4xl mx-auto">
            {/* Хлебные крошки — включая текущую статью */}
            <nav
                className="flex items-center gap-2 text-sm text-white/50 mb-4 flex-wrap"
                aria-label="Хлебные крошки"
            >
                <Link to="/app/wiki" className="hover:text-white transition flex items-center gap-1">
                    📚 ВикиМедиа
                </Link>
                {article.category && (
                    <>
                        <span className="text-white/30">/</span>
                        <Link
                            to={`/app/wiki?cat=${article.category.slug}`}
                            className="hover:text-white transition"
                        >
                            {article.category.icon} {article.category.title}
                        </Link>
                    </>
                )}
                <span className="text-white/30">/</span>
                <span className="text-white/80 font-medium truncate max-w-[300px]" title={article.title}>
                    {article.title}
                </span>
            </nav>

            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{article.title}</h1>
                <div className="flex flex-wrap gap-2 items-center text-xs text-white/40">
                    {article.tags.map((t) => (
                        <span key={t} className="chip bg-white/5 text-white/60">
                            #{t}
                        </span>
                    ))}
                    <span>👁 {article.views}</span>
                    <span>
                        Обновлено {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
                    </span>
                    {article.author && <span>Автор: {article.author.fullName}</span>}
                </div>
            </div>

            {article.cover && (
                <div className="rounded-2xl overflow-hidden mb-6">
                    <img src={article.cover} alt="" className="w-full max-h-72 object-cover" />
                </div>
            )}

            <article className="card p-5 md:p-7">
                <MarkdownView text={article.content} className="text-white/85 leading-relaxed" />
            </article>

            {article.related?.length > 0 && (
                <div className="mt-8">
                    <div className="text-lg font-bold mb-3">📖 Ещё в этой категории</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {article.related.map((r) => (
                            <Link
                                key={r.id}
                                to={`/app/wiki/${r.slug}`}
                                className="card p-4 hover:-translate-y-0.5 transition"
                            >
                                <div className="font-semibold mb-1">{r.title}</div>
                                {r.excerpt && (
                                    <div className="text-xs text-white/50 line-clamp-2">
                                        {r.excerpt}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 text-center">
                <Link to="/app/wiki" className="btn-ghost">
                    ← Вернуться в базу знаний
                </Link>
            </div>

            {user?.role === 'ADMIN' && (
                <div className="mt-6 text-center text-xs text-white/40">
                    <Link to="/app/admin" className="hover:text-white transition">
                        ⚙️ Редактировать статью в админ-панели
                    </Link>
                </div>
            )}
        </div>
    );
}

function MarkdownView({ text }) {
    const html = renderMarkdown(text);
    return <div className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInline(line) {
    let s = escapeHtml(line);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
    return s;
}

function renderMarkdown(text) {
    if (!text) return '';

    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inCode = false;
    let codeBuf = [];
    let inList = false;
    let inOrderedList = false;
    let inBlockquote = false;

    const closeList = () => {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inOrderedList) { out.push('</ol>'); inOrderedList = false; }
    };
    const closeBlockquote = () => {
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
    };

    for (const rawLine of lines) {
        const line = rawLine;

        if (line.trim().startsWith('```')) {
            if (inCode) {
                out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
                codeBuf = [];
                inCode = false;
            } else {
                closeList();
                closeBlockquote();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            codeBuf.push(line);
            continue;
        }
        if (!line.trim()) {
            closeList();
            closeBlockquote();
            continue;
        }

        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            closeList();
            closeBlockquote();
            const lvl = h[1].length;
            out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`);
            continue;
        }

        if (line.startsWith('> ')) {
            closeList();
            if (!inBlockquote) { out.push('<blockquote>'); inBlockquote = true; }
            out.push(`<p>${renderInline(line.slice(2))}</p>`);
            continue;
        } else {
            closeBlockquote();
        }

        if (/^[-*]\s+/.test(line)) {
            if (inOrderedList) { out.push('</ol>'); inOrderedList = false; }
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inOrderedList) { out.push('<ol>'); inOrderedList = true; }
            out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }

        closeList();
        out.push(`<p>${renderInline(line)}</p>`);
    }

    if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    }
    closeList();
    closeBlockquote();

    return out.join('\n');
}