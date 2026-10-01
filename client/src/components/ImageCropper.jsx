import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';

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

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="card max-w-xl w-full p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">{title || 'Обрезка изображения'}</div>
                    <button onClick={onCancel} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>

                <div className="relative w-full h-[340px] md:h-[400px] bg-black rounded-2xl overflow-hidden">
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

                <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-white/40 shrink-0">Масштаб</span>
                    <input
                        type="range" min={1} max={4} step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-violet"
                    />
                    <span className="text-xs text-white/40 w-10 text-right">{zoom.toFixed(1)}×</span>
                </div>

                <div className="flex gap-3 justify-end mt-4">
                    <button onClick={onCancel} className="btn-ghost">Отмена</button>
                    <button onClick={confirm} disabled={busy} className="btn-primary">
                        {busy ? 'Обработка…' : 'Готово'}
                    </button>
                </div>
            </div>
        </div>
    );
}