import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import MarkdownView from '../components/MarkdownView.jsx';
import { readOfflineWiki, saveOfflineWiki, removeOfflineWiki } from '../lib/wikiOffline.js';

export default function WikiArticle() {
    const { slug } = useParams();
    const { token, user } = useAuth();
    const nav = useNavigate();
    const [article, setArticle] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [tocOpen, setTocOpen] = useState(false);
    const [offlineSaved, setOfflineSaved] = useState(false);
    const [offlineView, setOfflineView] = useState(false);
    const [personal, setPersonal] = useState({ bookmarked: false, checklist: [] });
    const [proposalOpen, setProposalOpen] = useState(false);
    const [proposalContent, setProposalContent] = useState('');
    const [proposalNote, setProposalNote] = useState('');
    const [feedback, setFeedback] = useState('');
    const checklist = useMemo(() => (article?.content || '').split('\n').filter(line => /^- \[ \] /.test(line)).map(line => line.slice(6)), [article]);
    const savePersonal = async (changes) => {
        try { setPersonal(await api('/wiki/state/' + slug, { method: 'PATCH', token, body: changes })); }
        catch (e) { setFeedback(e.message); }
    };
    const submitProposal = async () => {
        try {
            await api('/wiki/proposals/' + slug, { method: 'POST', token, body: { content: proposalContent, note: proposalNote } });
            setProposalOpen(false); setFeedback('Предложение отправлено редактору.');
        } catch (e) { setFeedback(e.message); }
    };

    useEffect(() => {
        setLoading(true);
        setError('');
        api(`/wiki/articles/${slug}`, { token })
            .then((item) => { setArticle(item); setOfflineView(false); })
            .catch(async (e) => { const cached = user?.id ? await readOfflineWiki(user.id,slug).catch(()=>null) : null; if(cached){setArticle(cached);setOfflineView(true)} else setError(e.message); })
            .finally(() => setLoading(false));
        api('/wiki/state/' + slug, { token }).then(setPersonal).catch(() => {});
        if(user?.id)readOfflineWiki(user.id,slug).then(v=>setOfflineSaved(!!v)).catch(()=>{});
        window.scrollTo({ top: 0 });
    }, [slug, token]);

    const headings = useMemo(() => (article?.content || '').split('\n').filter(line => /^#{2,3}\s/.test(line)).map((line, index) => ({ title: line.replace(/^#{2,3}\s+/, ''), index })), [article]);

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

            <div className="mb-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => savePersonal({ bookmarked: !personal.bookmarked })}>
                    {personal.bookmarked ? '★ В закладках' : '☆ В закладки'}
                </button>
                <button className="btn-ghost" onClick={() => { setProposalContent(article.content); setProposalOpen(true); }}>
                    ✎ Предложить правку
                </button>
            </div>
            {feedback && <p role="status" className="text-sm text-white/70 mb-4">{feedback}</p>}
            {offlineView && <div className="mb-4 rounded-xl border border-amber-500/30 p-3 text-sm">Офлайн-копия. Изменения в оригинале могут быть новее.</div>}
            <div className="mb-4"><button className="btn-ghost" onClick={async()=>{
                if(!user?.id)return;
                try{
                    if(offlineSaved){await removeOfflineWiki(user.id,slug);setOfflineSaved(false)}
                    else {await saveOfflineWiki(user.id,article);setOfflineSaved(true)}
                }catch(e){setFeedback('Не удалось сохранить для офлайн-доступа: '+e.message)}
            }}>{offlineSaved?'✓ Удалить офлайн-копию':'↓ Сохранить для офлайн-чтения'}</button></div>
            {article.cover && (
                <div className="rounded-2xl overflow-hidden mb-6">
                    <img src={article.cover} alt="" className="w-full max-h-72 object-cover" />
                </div>
            )}

            {headings.length > 0 && (
                <nav aria-label="Содержание статьи" className="card mb-4 overflow-hidden">
                    <button type="button" aria-expanded={tocOpen} onClick={() => setTocOpen((v) => !v)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition">
                        <span className="text-sm font-semibold">☰ Содержание <span className="ml-1 text-xs font-normal opacity-50">({headings.length})</span></span>
                        <span aria-hidden="true" className="text-xs text-white/60">{tocOpen ? '▲' : '▼'}</span>
                    </button>
                    {tocOpen && <ol className="border-t border-white/10 px-4 py-3 grid gap-2 text-sm">
                        {headings.map((heading) => (
                            <li key={heading.index}>
                                <button type="button" className="text-violet-soft text-left hover:underline"
                                    onClick={() => {
                                        document.querySelectorAll('.wiki-article-content h2, .wiki-article-content h3')[heading.index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        setTocOpen(false);
                                    }}>
                                    {heading.title}
                                </button>
                            </li>
                        ))}
                    </ol>}
                </nav>
            )}
            <article className="card p-5 md:p-7 wiki-article-content">
                <MarkdownView text={article.content.replace(/^- \[ \] .*$/gm, "")} className="text-white/85 leading-relaxed" />
            </article>

            {checklist.length > 0 && (
                <section className="card p-5 mt-5" aria-label="Мой чек-лист">
                    <h2 className="font-bold mb-2">✓ Мой чек-лист</h2>
                    <p className="text-xs text-white/50 mb-4">Отметки сохраняются только для вашего аккаунта.</p>
                    <div className="space-y-3">{checklist.map((item, index) => (
                        <label key={index} className="flex items-start gap-3 text-sm">
                            <input type="checkbox" checked={(personal.checklist || []).includes(index)}
                                onChange={() => savePersonal({ checklist: (personal.checklist || []).includes(index)
                                    ? personal.checklist.filter(i => i !== index) : [...(personal.checklist || []), index] })} />
                            <span>{item}</span>
                        </label>
                    ))}</div>
                </section>
            )}
            {proposalOpen && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Предложить правку">
                <div className="card max-w-3xl mx-auto p-5 space-y-3">
                    <h2 className="font-bold text-lg">Предложить исправление статьи</h2>
                    <p className="text-xs text-white/60">Предложение проверит администратор. Опубликованный текст не изменится до одобрения.</p>
                    <textarea className="input w-full font-mono text-sm" rows={14} value={proposalContent} onChange={e => setProposalContent(e.target.value)} />
                    <input className="input w-full" placeholder="Комментарий редактору (необязательно)" value={proposalNote} onChange={e => setProposalNote(e.target.value)} />
                    <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setProposalOpen(false)}>Отмена</button><button className="btn-primary" onClick={submitProposal}>Отправить</button></div>
                </div>
            </div>}
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
                    <Link to="/app/admin?tab=wiki" className="hover:text-white transition">
                        ⚙️ Редактировать статью в админ-панели
                    </Link>
                </div>
            )}
        </div>
    );
}