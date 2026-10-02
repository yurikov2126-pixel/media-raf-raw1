import { useEffect, useState } from 'react';

/* Общий полноэкранный просмотрщик изображений.
   Используется в Messenger.jsx и MediaGalleryModal.jsx. */
export default function ImageViewer({ images, startIndex = 0, onClose }) {
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

    if (!images.length) return null;
    const current = images[index];
    const prev = (e) => { e?.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); };
    const next = (e) => { e?.stopPropagation(); setIndex((i) => (i + 1) % images.length); };

    return (
        <div
            className="fixed inset-0 z-[120] bg-black/95 flex flex-col animate-pop"
            onClick={onClose}
        >
            <div
                className="flex items-center justify-between p-3 md:p-4 text-white shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-sm opacity-70">{index + 1} / {images.length}</div>
                <button
                    onClick={onClose}
                    className="text-2xl opacity-70 hover:opacity-100 w-9 h-9 grid place-items-center"
                    aria-label="Закрыть"
                >✕</button>
            </div>
            <div
                className="flex-1 relative flex items-center justify-center px-2 md:px-12 pb-4 min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                {images.length > 1 && (
                    <button
                        onClick={prev}
                        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
                    >‹</button>
                )}
                <img
                    src={current.url}
                    alt=""
                    className="max-h-full max-w-full rounded-2xl object-contain select-none"
                    onClick={(e) => e.stopPropagation()}
                />
                {images.length > 1 && (
                    <button
                        onClick={next}
                        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
                    >›</button>
                )}
            </div>
        </div>
    );
}