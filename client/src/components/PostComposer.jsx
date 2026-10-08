import { useRef, useState } from 'react';
import { api, uploadBlob, uploadFile } from '../api/client.js';
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
    const [selectedFile, setSelectedFile] = useState(null);
    const fileRef = useRef(null);
    const draft = usePostDraft(user?.id);
    const text = draft.text;
    const setText = draft.setText;


    const publish = async () => {
        if ((!text.trim() && !gallery.length) || uploading || publishing || selectedFile) return;
        setPublishing(true);
        setComposeError('');
        try {
            await api('/posts', {
                method: 'POST',
                token,
                body: { content: text, mediaUrl: gallery[0] || null, mediaUrls: gallery, mediaType: gallery.length > 1 ? 'gallery' : (gallery.length ? 'image' : null) },
            });
            draft.clear();
            setGallery([]);
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
        setCropping(null);
        setUploading(true);
        setComposeError('');
        try {
            const uploaded = await uploadBlob(blob, `post-${Date.now()}.jpg`, token);
            const url = uploaded.absoluteUrl || uploaded.url || uploaded.path;
            if (!url) throw new Error('Сервер не вернул адрес фотографии');
            setGallery((previous) => [...previous, url].slice(0, 10));
            setSelectedFile(null);
        } catch (e) {
            setComposeError(e.message || 'Не удалось загрузить фото');
        } finally {
            setUploading(false);
        }
    };

    const uploadOriginal = async () => {
        if (!selectedFile || uploading) return;
        setUploading(true);
        setComposeError('');
        try {
            const uploaded = await uploadFile(selectedFile, token);
            const url = uploaded.absoluteUrl || uploaded.url || uploaded.path;
            if (!url) throw new Error('Сервер не вернул адрес фотографии');
            setGallery((previous) => [...previous, url].slice(0, 10));
            setSelectedFile(null);
        } catch (e) {
            setComposeError(e.message || 'Не удалось загрузить фото');
        } finally {
            setUploading(false);
        }
    };


    return (
        <>
                <section className="card p-4 md:p-6 mb-6" data-post-composer="true" aria-label="Создание публикации">
                    <textarea autoFocus className="input resize-none w-full" rows={4} placeholder="Что нового у команды?" value={text} onChange={(e) => setText(e.target.value)} />
                    {draft.hasDraft && <p className="text-xs text-white/40 mt-2">Черновик сохраняется автоматически</p>}
                    {selectedFile && !cropping && (
                        <div className="card p-3 mt-3 flex flex-wrap gap-2 items-center justify-between">
                            <span className="text-sm min-w-0 break-all">📷 {selectedFile.name}</span>
                            <div className="flex gap-2 flex-wrap">
                                <button type="button" className="btn-ghost" disabled={uploading} onClick={() => setCropping({ file: selectedFile })}>Обрезать (4:3)</button>
                                <button type="button" className="btn-primary" disabled={uploading} onClick={uploadOriginal}>{uploading ? 'Загрузка…' : 'Загрузить без обрезки'}</button>
                                <button type="button" className="btn-ghost" disabled={uploading} onClick={() => setSelectedFile(null)}>Убрать</button>
                            </div>
                        </div>
                    )}
                    {gallery.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">{gallery.map((url, index) => <div key={index} className="relative"><img src={url} alt={`Фото ${index + 1}`} className="h-32 w-full object-cover rounded-xl" /><button type="button" className="absolute right-1 top-1 bg-black/80 rounded-lg px-2" onClick={() => setGallery((a) => a.filter((_, i) => i !== index))} aria-label="Удалить фото">✕</button><div className="flex gap-1 mt-1"><button type="button" disabled={index === 0} onClick={() => setGallery((a) => { const b = [...a]; [b[index - 1], b[index]] = [b[index], b[index - 1]]; return b; })}>←</button><button type="button" disabled={index === gallery.length - 1} onClick={() => setGallery((a) => { const b = [...a]; [b[index + 1], b[index]] = [b[index], b[index + 1]]; return b; })}>→</button></div></div>)}</div>}
                    {preview && (
                        <div className="ui-compose-preview mt-4" aria-label="Предпросмотр публикации">
                            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Так публикация будет выглядеть в ленте</div>
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar user={user} size={40} />
                                <div className="min-w-0"><div className="font-semibold truncate">{user.fullName}</div><div className="text-xs text-white/40">@{user.username} · сейчас</div></div>
                            </div>
                            {text.trim() && <p className="whitespace-pre-wrap break-words text-white/90">{text}</p>}
                            {gallery.map((url, index) => <img key={index} className="w-full max-h-96 object-contain rounded-xl mt-3" src={url} alt={`Фото ${index + 1}`} />)}
                            {image && <img className="w-full max-h-96 object-contain rounded-xl mt-3" src={image} alt="Предпросмотр фотографии" />}
                            {!text.trim() && !gallery.length && <p className="text-white/40 text-sm">Добавьте текст или фотографию для предпросмотра.</p>}
                        </div>
                    )}
                    {composeError && <p role="alert" className="text-pink text-sm mt-2">{composeError}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <button type="button" className="btn-ghost" disabled={uploading || publishing || gallery.length >= 10} onClick={() => fileRef.current?.click()}>{uploading ? 'Загрузка…' : '📷 Добавить фото'}</button>
                        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = '';
                            const remaining = 10 - gallery.length;
                            if (files.length > remaining) { setComposeError(`Можно добавить ещё ${remaining} фото`); return; }
                            if (files.some((file) => !file.type.startsWith('image/'))) { setComposeError('Выберите изображения'); return; }
                            if (files.length === 1) { setSelectedFile(files[0]); setComposeError(''); return; }
                            setUploading(true); setComposeError('');
                            const urls = [];
                            try {
                                for (const file of files) {
                                    const uploaded = await uploadFile(file, token);
                                    const url = uploaded.absoluteUrl || uploaded.url || uploaded.path;
                                    if (!url) throw new Error('Сервер не вернул адрес фотографии');
                                    urls.push(url);
                                }
                                setGallery((previous) => [...previous, ...urls].slice(0, 10));
                            } catch (err) {
                                setGallery((previous) => [...previous, ...urls].slice(0, 10));
                                setComposeError(err.message || 'Ошибка загрузки фото');
                            } finally { setUploading(false); }
                        }} />
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
