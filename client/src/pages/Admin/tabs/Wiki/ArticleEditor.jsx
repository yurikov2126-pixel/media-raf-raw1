import { useState } from 'react';
import { api } from '../../../../api/client.js';
import { renderMarkdownSimple } from '../../utils.js';

export default function ArticleEditor({ token, initial, isNew, categories, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: initial?.title || '',
        slug: initial?.slug || '',
        excerpt: initial?.excerpt || '',
        content: initial?.content || '',
        cover: initial?.cover || '',
        categoryId: initial?.categoryId || (categories[0]?.id ?? ''),
        tags: (initial?.tags || []).join(', '),
        published: initial?.published ?? true,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        if (!form.title.trim() || !form.content.trim()) { setError('Заполните название и текст'); return; }
        setBusy(true); setError('');
        try {
            const payload = {
                title: form.title,
                slug: form.slug || undefined,
                excerpt: form.excerpt,
                content: form.content,
                cover: form.cover || null,
                categoryId: form.categoryId || null,
                tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
                published: !!form.published,
            };
            if (isNew) {
                await api('/admin/wiki/articles', { method: 'POST', token, body: payload });
            } else {
                await api(`/admin/wiki/articles/${initial.id}`, { method: 'PATCH', token, body: payload });
            }
            await onSaved();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6" onClick={onClose}>
            <div className="card max-w-4xl mx-auto my-4 p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">{isNew ? 'Новая статья' : `Статья: ${initial.title}`}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPreview((p) => !p)} className="btn-ghost !py-1.5 !px-3 text-xs">
                            {preview ? '✏️ Редактор' : '👁 Превью'}
                        </button>
                        <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                    </div>
                </div>

                {!preview && (
                    <>
                        <input className="input mb-3" value={form.title} onChange={set('title')} placeholder="Заголовок" />
                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                            <input className="input font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="slug (auto)" />
                            <select className="input" value={form.categoryId} onChange={set('categoryId')}>
                                <option value="">— без категории —</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.title}</option>)}
                            </select>
                        </div>
                        <input className="input mb-3" value={form.excerpt} onChange={set('excerpt')} placeholder="Краткое описание" />
                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                            <input className="input" value={form.tags} onChange={set('tags')} placeholder="Теги через запятую" />
                            <input className="input" value={form.cover} onChange={set('cover')} placeholder="Обложка (URL)" />
                        </div>
                        <textarea rows={16} className="input resize-none font-mono text-sm" value={form.content} onChange={set('content')} placeholder="# Заголовок…" />
                        <label className="flex items-center gap-2 mt-3">
                            <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
                            Опубликовано
                        </label>
                    </>
                )}

                {preview && (
                    <div className="card p-5 bg-ink-700/50">
                        <h1 className="text-2xl font-bold mb-3">{form.title || 'Без названия'}</h1>
                        {form.excerpt && <p className="text-white/60 mb-4">{form.excerpt}</p>}
                        <div className="wiki-content" dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(form.content) }} />
                    </div>
                )}

                {error && <p className="text-pink text-sm mt-3">{error}</p>}

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onClose} className="btn-ghost">Отмена</button>
                    <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Сохранение…' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    );
}