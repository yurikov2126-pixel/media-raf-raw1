import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { resolveUrl } from '../api/client.js';

function extractPhotos(post) {
    if (Array.isArray(post.mediaUrls) && post.mediaUrls.length) return post.mediaUrls;
    if (!post.mediaUrl || post.mediaType === 'video') return [];
    if (post.mediaType === 'gallery') {
        try { const urls = JSON.parse(post.mediaUrl); return Array.isArray(urls) ? urls : []; }
        catch { return []; }
    }
    return [post.mediaUrl];
}

export default function ProfilePhotoGallery({ posts = [], onOpenPost }) {
    const photos = posts.flatMap((post) => extractPhotos(post).map((url, index) => ({ url, post, index })));
    const [active, setActive] = useState(null);
    useEffect(() => {
        if (active === null) return;
        const handleKey = (event) => {
            if (event.key === 'Escape') setActive(null);
            if (event.key === 'ArrowRight') setActive((n) => Math.min(photos.length - 1, n + 1));
            if (event.key === 'ArrowLeft') setActive((n) => Math.max(0, n - 1));
        };
        window.addEventListener('keydown', handleKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; };
    }, [active, photos.length]);
    if (!photos.length) return <div className="profile-v2__empty my-6"><span className="profile-v2__empty-icon">📷</span><span className="text-white/60">Фотографий пока нет. Они появятся здесь после публикации.</span></div>;
    return (
        <section className="py-6" aria-label="Фотографии пользователя">
            <div className="flex justify-between items-center gap-3 mb-4">
                <h2 className="text-lg font-bold">Фотографии</h2>
                <span className="text-sm text-white/50">{photos.length} фото из {posts.length} публикаций</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {photos.map(({ url, post, index }, position) => (
                    <button type="button" key={`${post.id}-${index}`} className="aspect-square rounded-2xl overflow-hidden bg-white/5 group relative focus-visible:ring-2 focus-visible:ring-violet-400" onClick={() => setActive(position)} aria-label={`Открыть фото ${position + 1}`}>
                        <img loading="lazy" src={resolveUrl(url)} alt={`Фото из публикации от ${new Date(post.createdAt).toLocaleDateString('ru-RU')}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        {index === 0 && extractPhotos(post).length > 1 && <span className="absolute top-2 right-2 rounded-lg bg-black/60 text-white text-xs px-2 py-1">▧ {extractPhotos(post).length}</span>}
                    </button>
                ))}
            </div>
            {createPortal(<AnimatePresence>{active !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] bg-[#080811]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Просмотр фотографий" onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
                    <button type="button" onClick={() => setActive(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-3 text-white" aria-label="Закрыть">✕</button>
                    <motion.img key={active} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} src={resolveUrl(photos[active].url)} alt="Фотография" className="max-w-full max-h-[75dvh] object-contain rounded-xl" />
                    <div className="mt-5 flex items-center gap-4">
                        <button type="button" disabled={active === 0} onClick={() => setActive((n) => n - 1)} className="rounded-2xl bg-white/10 p-3 disabled:opacity-30" aria-label="Предыдущее фото">←</button>
                        <span className="text-sm text-white/70">{active + 1} / {photos.length}</span>
                        <button type="button" disabled={active === photos.length - 1} onClick={() => setActive((n) => n + 1)} className="rounded-2xl bg-white/10 p-3 disabled:opacity-30" aria-label="Следующее фото">→</button>
                    </div>
                </motion.div>
            )}</AnimatePresence>, document.body)}
        </section>
    );
}
