import { useEffect, useState } from 'react';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const TABS = [
    { v: 'image', l: '🖼️ Фото' },
    { v: 'video', l: '🎥 Видео' },
    { v: 'voice', l: '🎤 Голосовые' },
    { v: 'file',  l: '📎 Файлы' },
];

export default function MediaGalleryModal({ chatId, onClose }) {
    const { token } = useAuth();
    const [tab, setTab] = useState('image');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(null);

    useEffect(() => {
        if (!chatId) return;
        setLoading(true);
        api(`/chats/${chatId}/media?type=${tab}`, { token })
            .then(setItems)
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [chatId, tab, token]);

    const images = items.filter((m) => m.type === 'image');

    return (
        <div
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onClose}
        >
            <div
                className="card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <div className="font-bold">Медиа и файлы</div>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>

                <div className="flex gap-2 px-4 py-3 border-b border-white/5">
                    {TABS.map((t) => (
                        <button
                            key={t.v}
                            onClick={() => setTab(t.v)}
                            className={`chip ${tab === t.v ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                        >
                            {t.l}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && <div className="text-center text-white/40 py-8">Загрузка…</div>}

                    {!loading && items.length === 0 && (
                        <div className="text-center text-white/40 py-8">Пока ничего нет</div>
                    )}

                    {!loading && tab === 'image' && (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                            {images.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setViewerIndex(images.findIndex((x) => x.id === m.id))}
                                    className="aspect-square rounded-xl overflow-hidden hover:opacity-90 transition"
                                >
                                    <img src={resolveUrl(m.content)} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            ))}
                        </div>
                    )}

                    {!loading && tab === 'video' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {items.map((m) => (
                                <div key={m.id} className="rounded-xl overflow-hidden bg-black">
                                    <video src={resolveUrl(m.content)} controls className="w-full h-40 object-cover" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && (tab === 'voice' || tab === 'file') && (
                        <div className="space-y-2">
                            {items.map((m) => (
                                <div key={m.id} className="card p-3 flex items-center gap-3">
                                    <div className="text-2xl">
                                        {tab === 'voice' ? '🎤' : '📎'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate">
                                            {m.sender?.fullName || 'Пользователь'}
                                        </div>
                                        <div className="text-xs text-white/40">
                                            {new Date(m.createdAt).toLocaleString('ru-RU')}
                                        </div>
                                    </div>
                                    <a
                                        href={resolveUrl(m.content)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="chip bg-white/5 hover:bg-white/10"
                                    >
                                        {tab === 'voice' ? '▶' : '⬇'}
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {viewerIndex !== null && images.length > 0 && (
                <ImageViewer
                    images={images.map((m) => ({ id: m.id, url: resolveUrl(m.content) }))}
                    startIndex={viewerIndex}
                    onClose={() => setViewerIndex(null)}
                />
            )}
        </div>
    );
}

function ImageViewer({ images, startIndex, onClose }) {
    const [index, setIndex] = useState(startIndex);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
            if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [images.length, onClose]);
    const prev = (e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); };
    const next = (e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); };
    return (
        <div
            className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white text-xl"
            >✕</button>
            {images.length > 1 && (
                <button
                    onClick={prev}
                    className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white text-2xl"
                >‹</button>
            )}
            <img
                src={images[index].url}
                alt=""
                className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
            />
            {images.length > 1 && (
                <button
                    onClick={next}
                    className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white text-2xl"
                >›</button>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                {index + 1} / {images.length}
            </div>
        </div>
    );
}