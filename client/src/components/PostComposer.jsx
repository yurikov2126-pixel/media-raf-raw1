import { useEffect, useRef, useState } from 'react';
import { api, uploadBlob, uploadFileWithProgress, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePostDraft from '../hooks/usePostDraft.js';
import ImageCropper from './ImageCropper.jsx';
import Avatar from './Avatar.jsx';

export default function PostComposer({ onPublished, onClose }) {
    const { user, token } = useAuth();
    const [gallery, setGallery] = useState([]);
    const [cropping, setCropping] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [composeError, setComposeError] = useState('');
    const [preview, setPreview] = useState(false);
    const [items, setItems] = useState([]);
    const itemsRef = useRef([]);
    const busyRef = useRef(false);
    const [editingId, setEditingId] = useState(null);
    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => () => { itemsRef.current.forEach((item) => URL.revokeObjectURL(item.thumbnail)); }, []);
    const changeItem = (id, patch) => setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
    const addFiles = async (files) => {
        if (busyRef.current || !files.length) return;
        const available = 10 - itemsRef.current.length;
        if (files.length > available) { setComposeError(`Можно добавить ещё ${available} фото`); return; }
        if (files.some((file) => !file.type.startsWith('image/'))) { setComposeError('Выберите изображения'); return; }
        busyRef.current = true;
        setUploading(true); setComposeError('');
        const added = files.map((file) => ({
            id: `${Date.now()}-${Math.random()}`, file, thumbnail: URL.createObjectURL(file),
            url: null, progress: 0, status: 'uploading',
        }));
        setItems((prev) => [...prev, ...added]);
        for (const item of added) {
            try {
                const result = await uploadFileWithProgress(item.file, token, (progress) => changeItem(item.id, { progress }));
                const url = result.absoluteUrl || result.url || result.path;
                if (!url) throw new Error('Сервер не вернул адрес фотографии');
                changeItem(item.id, { url, status: 'done', progress: 100 });
            } catch (error) {
                changeItem(item.id, { status: 'error', error: error.message });
            }
        }
        busyRef.current = false;
        setUploading(false);
    };
    const editPhoto = async (item) => {
        setComposeError('');
        try {
            const response = await fetch(resolveUrl(item.url));
            if (!response.ok) throw new Error('Не удалось открыть загруженное фото');
            const blob = await response.blob();
            setEditingId(item.id);
            setCropping({ file: new File([blob], 'edit.jpg', { type: blob.type || 'image/jpeg' }) });
        } catch (error) { setComposeError(error.message); }
    };
    const movePhoto = (index, delta) => setItems((prev) => {
        const next = [...prev], target = index + delta;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    });
    const fileRef = useRef(null);
    const draft = usePostDraft(user?.id);
    const text = draft.text;
    const setText = draft.setText;


    const publish = async () => {
        if ((!text.trim() && !items.some((item) => item.status === 'done')) || uploading || publishing || items.some((item) => item.status !== 'done')) return;
        setPublishing(true);
        setComposeError('');
        try {
            const gallery = items.map((item) => item.url);
            await api('/posts', {
                method: 'POST',
                token,
                body: { content: text, mediaUrl: gallery[0] || null, mediaUrls: gallery, mediaType: gallery.length > 1 ? 'gallery' : (gallery.length ? 'image' : null) },
            });
            draft.clear();
            items.forEach((item) => URL.revokeObjectURL(item.thumbnail));
            setItems([]);
            setPreview(false);
            setSelectedFile(null);
            await onPublished?.();
        } catch (e) {
            setComposeError(e.message || 'Не удалось опубликовать запись');
        } finally {
            setPublishing(false);
        }
    };

    const onCrop = async (blob) => {
        const id = editingId;
        setCropping(null);
        setEditingId(null);
        setUploading(true);
        changeItem(id, { status: 'uploading', progress: 0 });
        try {
            const result = await uploadBlob(blob, `edited-${Date.now()}.jpg`, token);
            const url = result.absoluteUrl || result.url || result.path;
            if (!url) throw new Error('Сервер не вернул адрес фотографии');
            changeItem(id, { url, status: 'done', progress: 100 });
        } catch (error) {
            changeItem(id, { status: 'done', progress: 100 });
            setComposeError(error.message || 'Не удалось сохранить изменения');
        } finally { setUploading(false); }
    };

    return (
        <>
                <section className="card p-4 md:p-6 mb-6" data-post-composer="true" aria-label="Создание публикации">
                    <textarea autoFocus className="input resize-none w-full" rows={4} placeholder="Что нового у команды?" value={text} onChange={(e) => setText(e.target.value)} />
                    {draft.hasDraft && <p className="text-xs text-white/40 mt-2">Черновик сохраняется автоматически</p>}
                    {items.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                            {items.map((item, index) => (
                                <div key={item.id} className="relative rounded-xl overflow-hidden bg-white/5 p-2">
                                    <div className="relative">
                                        <img src={item.thumbnail} alt={`Фото ${index + 1}`} className="h-32 w-full object-cover rounded-lg" />
                                        {item.status === 'uploading' && (
                                            <div className="absolute inset-0 bg-black/65 flex flex-col justify-end p-2" role="status">
                                                <span className="text-xs text-white">{item.progress}%</span>
                                                <div className="h-2 bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-violet-400 transition-all" style={{ width: `${item.progress}%` }} /></div>
                                            </div>
                                        )}
                                        {item.status === 'error' && <div className="absolute inset-0 bg-black/75 text-red-300 text-xs p-2 flex items-center">{item.error || 'Ошибка загрузки'}</div>}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        <button type="button" className="btn-ghost !p-1 text-xs" disabled={uploading || item.status !== 'done'} onClick={() => editPhoto(item)}>Редактировать</button>
                                        <button type="button" className="btn-ghost !p-1" disabled={uploading || index === 0} onClick={() => movePhoto(index, -1)} aria-label="Сдвинуть влево">←</button>
                                        <button type="button" className="btn-ghost !p-1" disabled={uploading || index === items.length - 1} onClick={() => movePhoto(index, 1)} aria-label="Сдвинуть вправо">→</button>
                                        <button type="button" className="btn-ghost !p-1" disabled={uploading} onClick={() => { URL.revokeObjectURL(item.thumbnail); setItems((prev) => prev.filter((photo) => photo.id !== item.id)); }} aria-label="Удалить фото">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {preview && (
                        <div className="ui-compose-preview mt-4" aria-label="Предпросмотр публикации">
                            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Так публикация будет выглядеть в ленте</div>
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar user={user} size={40} />
                                <div className="min-w-0"><div className="font-semibold truncate">{user.fullName}</div><div className="text-xs text-white/40">@{user.username} · сейчас</div></div>
                            </div>
                            {text.trim() && <p className="whitespace-pre-wrap break-words text-white/90">{text}</p>}
                            {items.filter((item) => item.status === 'done').map((item, index) => <img key={item.id} className="w-full max-h-96 object-contain rounded-xl mt-3" src={resolveUrl(item.url)} alt={`Фото ${index + 1}`} />)}
                            {image && <img className="w-full max-h-96 object-contain rounded-xl mt-3" src={image} alt="Предпросмотр фотографии" />}
                            {!text.trim() && !items.length && <p className="text-white/40 text-sm">Добавьте текст или фотографию для предпросмотра.</p>}
                        </div>
                    )}
                    {composeError && <p role="alert" className="text-pink text-sm mt-2">{composeError}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <button type="button" className="btn-ghost" disabled={uploading || publishing || items.length >= 10} onClick={() => fileRef.current?.click()}>{uploading ? 'Загрузка…' : '📷 Добавить фото'}</button>
                        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; addFiles(files); }} />
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? "Скрыть предпросмотр" : "Предпросмотр"}</button>
                            <button type="button" className="btn-ghost" onClick={() => onClose?.()} disabled={publishing || uploading}>Закрыть</button>
                            <button type="button" className="btn-primary" onClick={publish} disabled={publishing || uploading || !!selectedFile || (!text.trim() && !gallery.length)}>{publishing ? 'Публикуем…' : 'Опубликовать'}</button>
                        </div>
                    </div>
                </section>
            {cropping && <ImageCropper file={cropping.file} aspect={4 / 3} outputWidth={1280} outputHeight={960} title="Обрезка фото — перемещайте и масштабируйте" onDone={onCrop} onCancel={() => setCropping(null)} />}


        </>
    );
}
