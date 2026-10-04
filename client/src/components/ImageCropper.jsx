import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { pushModal } from '../lib/modalStack.js';

export function getCroppedBlob(imageSrc, cropPixels, outputSize) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = outputSize.width;
            canvas.height = outputSize.height;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                image,
                cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
                0, 0, outputSize.width, outputSize.height
            );
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать изображение'))),
                'image/jpeg',
                0.92
            );
        };
        image.onerror = () => reject(new Error('Не удалось загрузить изображение'));
        image.src = imageSrc;
    });
}

export default function ImageCropper({
                                         file, aspect, outputWidth, outputHeight, title,
                                         onCancel, onDone,
                                     }) {
    const [src, setSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [pixels, setPixels] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    /* Регистрируем в стеке модалок */
    useEffect(() => {
        if (!src) return;
        const release = pushModal();
        return release;
    }, [src]);

    /* Escape */
    useEffect(() => {
        if (!src) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !busy) onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [src, busy, onCancel]);

    const onCropComplete = useCallback((_area, areaPixels) => {
        setPixels(areaPixels);
    }, []);

    const confirm = async () => {
        if (!pixels) return;
        setBusy(true);
        try {
            const blob = await getCroppedBlob(src, pixels, {
                width: outputWidth,
                height: outputHeight,
            });
            onDone(blob);
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    if (!src) return null;

    const modal = createPortal(
        <div
            className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-sm grid place-items-center"
            style={{
                overscrollBehavior: 'contain',
                overflow: 'hidden',
                paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
                paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !busy) onCancel();
            }}
        >
            <div
                className="
                    flex flex-col w-full h-full
                    md:w-auto md:h-auto md:max-w-xl md:rounded-3xl md:border
                    bg-ink-900 md:bg-ink-800/90 border-white/10 md:backdrop-blur-xl
                    md:shadow-2xl md:shadow-black/50
                    min-w-0 max-w-full overflow-hidden
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* Шапка */}
                <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-white/5">
                    <div className="font-bold truncate pr-2">
                        {title || 'Обрезка изображения'}
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="w-10 h-10 shrink-0 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition text-xl disabled:opacity-40"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {/* Область кроппера — гибкая высота */}
                <div className="flex-1 min-h-0 px-3 py-3 md:px-5 md:py-4 flex">
                    <div className="relative w-full min-h-[220px] bg-black rounded-2xl overflow-hidden flex-1">
                        <Cropper
                            image={src}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            showGrid
                            restrictPosition
                        />
                    </div>
                </div>

                {/* Масштаб */}
                <div className="shrink-0 px-4 md:px-5 pb-3 flex items-center gap-3">
                    <span className="text-xs text-white/40 shrink-0">Масштаб</span>
                    <input
                        type="range" min={1} max={4} step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-violet"
                    />
                    <span className="text-xs text-white/40 w-10 text-right tabular-nums">
                        {zoom.toFixed(1)}×
                    </span>
                </div>

                {/* Футер с кнопками */}
                <div className="shrink-0 flex gap-3 px-4 md:px-5 py-3 border-t border-white/5 bg-ink-900/95 md:bg-ink-800/40">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="btn-ghost flex-1 md:flex-none md:min-w-[120px]"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={confirm}
                        disabled={busy}
                        className="btn-primary flex-1 md:flex-none md:min-w-[140px]"
                    >
                        {busy ? 'Обработка…' : 'Готово'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    return modal;
}