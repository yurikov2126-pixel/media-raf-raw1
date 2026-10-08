import { useEffect, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

function fromPost(post) {
    if (!post.mediaUrl || post.mediaType === 'video') return [];
    if (post.mediaType === 'gallery') {
        try { return JSON.parse(post.mediaUrl) || []; } catch { return []; }
    }
    return [post.mediaUrl];
}
const empty = { title: '', description: '', photos: [], coverUrl: '' };

export default function ProfileAlbums({ username, posts = [], isMe }) {
    const { token } = useAuth();
    const [albums, setAlbums] = useState([]);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState(empty);
    const [viewing, setViewing] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const available = [...new Set(posts.flatMap(fromPost))];
    const reload = () => api(`/albums/user/${encodeURIComponent(username)}`, { token }).then(setAlbums).catch(() => setError('Не удалось загрузить альбомы'));
    useEffect(() => { setViewing(null); setEditing(null); reload(); }, [username, token]);
    const edit = (album) => { setError(''); setEditing(album?.id || 'new'); setDraft(album ? { title: album.title, description: album.description, photos: [...album.photos], coverUrl: album.coverUrl || '' } : { ...empty, photos: [] }); };
    const save = async () => {
        setSaving(true); setError('');
        try {
            await api(editing === 'new' ? '/albums' : `/albums/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', token, body: draft });
            setEditing(null); await reload();
        } catch (e) { setError(e.message || 'Не удалось сохранить'); }
        finally { setSaving(false); }
    };
    const remove = async (id) => {
        if (!window.confirm('Удалить альбом? Сами публикации и фотографии останутся.')) return;
        try { await api(`/albums/${id}`, { method: 'DELETE', token }); await reload(); }
        catch (e) { setError(e.message); }
    };
    return <section className="py-6 space-y-5">
        <div className="flex justify-between gap-3 items-center"><div><h2 className="text-xl font-bold">Фотоальбомы</h2><p className="text-sm text-white/50">Подборки работ и памятных моментов</p></div>{isMe && <button type="button" className="btn-primary" onClick={() => edit(null)}>+ Альбом</button>}</div>
        {error && <p role="alert" className="text-pink text-sm">{error}</p>}
        {editing && <div className="card p-4 space-y-4">
            <h3 className="font-semibold">{editing === 'new' ? 'Новый альбом' : 'Редактировать альбом'}</h3>
            <label className="block text-sm">Название<input className="input w-full mt-1" maxLength={80} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Например, Наши съёмки" /></label>
            <label className="block text-sm">Описание<textarea className="input w-full mt-1" maxLength={500} rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></label>
            <div className="text-sm font-semibold">Выберите фотографии из своих публикаций ({draft.photos.length}/100)</div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
                {available.map((url) => { const chosen = draft.photos.includes(url); return <button key={url} type="button" aria-pressed={chosen} className={`relative aspect-square rounded-xl overflow-hidden ${chosen ? 'ring-2 ring-violet-400' : ''}`} onClick={() => setDraft((d) => { const photos = chosen ? d.photos.filter((x) => x !== url) : d.photos.length < 100 ? [...d.photos, url] : d.photos; return { ...d, photos, coverUrl: photos.includes(d.coverUrl) ? d.coverUrl : photos[0] || '' }; })}><img src={resolveUrl(url)} alt="Выбрать фотографию" loading="lazy" className="w-full h-full object-cover" />{chosen && <span className="absolute right-1 top-1 bg-violet-600 text-white rounded-full px-2">✓</span>}</button>; })}
            </div>
            {draft.photos.length > 0 && <><p className="text-sm font-semibold">Обложка альбома</p><div className="flex gap-2 overflow-x-auto pb-2">{draft.photos.map((url) => <button type="button" key={url} onClick={() => setDraft((d) => ({ ...d, coverUrl: url }))} className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden ${draft.coverUrl === url ? 'ring-2 ring-violet-400' : ''}`} aria-label="Выбрать обложку"><img src={resolveUrl(url)} alt="" className="w-full h-full object-cover" /></button>)}</div></>}
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Отмена</button><button type="button" className="btn-primary" disabled={saving || !draft.title.trim()} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
        </div>}
        {!albums.length && !editing && <p className="text-center text-white/50 py-10">Пока нет альбомов</p>}
        {!viewing ? <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{albums.map((album) => <div key={album.id} className="card overflow-hidden"><button type="button" className="w-full text-left" onClick={() => setViewing(album)}><div className="aspect-[4/3] bg-white/5">{album.coverUrl && <img src={resolveUrl(album.coverUrl)} alt="" className="w-full h-full object-cover" />}</div><div className="p-3"><div className="font-semibold truncate">{album.title}</div><div className="text-xs text-white/50">{album.photos.length} фото</div></div></button>{isMe && <div className="flex gap-2 px-3 pb-3"><button type="button" className="btn-ghost text-xs" onClick={() => edit(album)}>Изменить</button><button type="button" className="btn-ghost text-xs" onClick={() => remove(album.id)}>Удалить</button></div>}</div>)}</div> : <div><button type="button" className="btn-ghost mb-3" onClick={() => setViewing(null)}>← Все альбомы</button><h3 className="text-xl font-bold">{viewing.title}</h3>{viewing.description && <p className="text-white/60 mt-1 mb-4">{viewing.description}</p>}<div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">{viewing.photos.map((url) => <a key={url} href={resolveUrl(url)} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden"><img src={resolveUrl(url)} alt="" loading="lazy" className="w-full h-full object-cover" /></a>)}</div></div>}
    </section>;
}
