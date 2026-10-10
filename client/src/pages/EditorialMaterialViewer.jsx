import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export default function EditorialMaterialViewer({ files, initialId, base, token, onClose, onError }) {
    const [index, setIndex] = useState(() => Math.max(0, files.findIndex(f => f.id === initialId)));
    const [urls, setUrls] = useState({});
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [showDetails, setShowDetails] = useState(true);
    const pointers = useRef(new Map());
    const gesture = useRef(null);
    const urlsRef = useRef(new Map());
    const requests = useRef(new Map());
    const stage = useRef(null);
    const lastTap = useRef(0);
    const active = files[index];
    const image = active?.mimeType?.startsWith('image/');
    const url = active ? urls[active.id] : null;

    const fetchFile = useCallback(async (file) => {
        if (!file || urlsRef.current.has(file.id) || requests.current.has(file.id)) return;
        const controller = new AbortController();
        requests.current.set(file.id, controller);
        try {
            const response = await fetch(API + base + '/' + file.id + '/content', {
                headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
            });
            if (!response.ok) throw new Error('Не удалось открыть материал');
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            const objectUrl = URL.createObjectURL(blob);
            urlsRef.current.set(file.id, objectUrl);
            setUrls(previous => ({ ...previous, [file.id]: objectUrl }));
        } catch (error) {
            if (error.name !== 'AbortError') onError(error.message);
        } finally {
            requests.current.delete(file.id);
        }
    }, [base, token, onError]);

    useEffect(() => () => {
        for (const request of requests.current.values()) request.abort();
        for (const objectUrl of urlsRef.current.values()) URL.revokeObjectURL(objectUrl);
        requests.current.clear();
        urlsRef.current.clear();
    }, []);

    useEffect(() => {
        setScale(1); setOffset({ x: 0, y: 0 }); setDragging(false);
        pointers.current.clear(); gesture.current = null;
        setLoading(!urlsRef.current.has(active?.id));
        void fetchFile(active);
        // Preload adjacent images to reduce the delay during swiping.
        for (const neighbor of [files[index - 1], files[index + 1]]) {
            if (neighbor?.mimeType?.startsWith('image/')) void fetchFile(neighbor);
        }
    }, [index, active?.id, files, fetchFile]);

    useEffect(() => { if (url) setLoading(false); }, [url]);

    const navigate = useCallback((step) => {
        setIndex(previous => clamp(previous + step, 0, files.length - 1));
    }, [files.length]);

    useEffect(() => {
        const keydown = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') navigate(1);
            if (event.key === 'ArrowLeft') navigate(-1);
            if (event.key === '+' || event.key === '=') setScale(v => clamp(v * 1.5, 1, 5));
            if (event.key === '-') setScale(v => clamp(v / 1.5, 1, 5));
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [navigate, onClose]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    function down(event) {
        if (!image) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        const points = [...pointers.current.values()];
        if (points.length === 2) {
            gesture.current = { type: 'pinch', distance: distance(points[0], points[1]), scale, offset };
        } else if (points.length === 1) {
            gesture.current = { type: 'move', x: event.clientX, y: event.clientY, offset, scale };
        }
        setDragging(true);
    }
    function move(event) {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        const points = [...pointers.current.values()];
        if (points.length === 2) {
            if (gesture.current?.type !== 'pinch') {
                gesture.current = { type: 'pinch', distance: distance(points[0], points[1]), scale, offset };
            }
            const nextScale = clamp(gesture.current.scale * distance(points[0], points[1]) / Math.max(1, gesture.current.distance), 1, 5);
            setScale(nextScale);
        } else if (points.length === 1 && gesture.current?.type === 'move' && scale > 1) {
            const width = stage.current?.clientWidth || 0;
            const height = stage.current?.clientHeight || 0;
            const limitX = (width * (scale - 1)) / 2;
            const limitY = (height * (scale - 1)) / 2;
            setOffset({
                x: clamp(gesture.current.offset.x + event.clientX - gesture.current.x, -limitX, limitX),
                y: clamp(gesture.current.offset.y + event.clientY - gesture.current.y, -limitY, limitY),
            });
        }
    }
    function up(event) {
        const started = gesture.current;
        pointers.current.delete(event.pointerId);
        if (pointers.current.size === 0) {
            setDragging(false);
            if (started?.type === 'move' && started.scale <= 1) {
                const deltaX = event.clientX - started.x;
                const deltaY = event.clientY - started.y;
                if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) navigate(deltaX < 0 ? 1 : -1);
            }
            gesture.current = null;
        } else {
            const remaining = [...pointers.current.values()][0];
            gesture.current = { type: 'move', x: remaining.clientX, y: remaining.clientY, offset, scale };
        }
    }
    function doubleTap() {
        if (!image) return;
        const now = Date.now();
        if (now - lastTap.current < 300) {
            setScale(value => value > 1 ? 1 : 2.5);
            setOffset({ x: 0, y: 0 });
        }
        lastTap.current = now;
    }
    function zoom(value) {
        setScale(current => {
            const next = clamp(current * value, 1, 5);
            if (next === 1) setOffset({ x: 0, y: 0 });
            return next;
        });
    }
    if (!active) return null;
    return createPortal(<div role="dialog" aria-modal="true" aria-label="Просмотр материалов" className="editorial-material-lightbox fixed inset-0 z-[10050] flex flex-col bg-slate-950 text-white">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/15 px-3 py-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{active.name}</p><p className="text-xs text-slate-300">{index + 1} из {files.length} · Версия {active.version}</p></div>
            {image && <><button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Уменьшить" className="rounded-lg border border-white/30 px-3 py-2">−</button><button type="button" onClick={() => zoom(1.5)} aria-label="Увеличить" className="rounded-lg border border-white/30 px-3 py-2">+</button></>}
            <button type="button" onClick={() => setShowDetails(v => !v)} aria-label="Показать или скрыть подпись" className="rounded-lg border border-white/30 px-3 py-2">ⓘ</button>
            <button type="button" onClick={onClose} aria-label="Закрыть просмотр" className="rounded-lg border border-white/30 px-3 py-2">✕</button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            {index > 0 && <button type="button" onClick={() => navigate(-1)} aria-label="Предыдущий материал" className="absolute left-2 z-10 hidden rounded-full bg-black/60 px-3 py-3 text-xl sm:block">‹</button>}
            <div ref={stage} className="flex h-full w-full items-center justify-center overflow-hidden" style={{ touchAction: image ? 'none' : 'auto' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={doubleTap}>
                {loading && <span className="text-sm text-slate-300">Загружаем материал…</span>}
                {url && image && <img draggable={false} src={url} alt={active.caption || active.name}
                    className="max-h-full max-w-full select-none object-contain"
                    style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, transition: dragging ? 'none' : 'transform 260ms cubic-bezier(.2,.8,.2,1)', willChange: 'transform' }} />}
                {url && active.mimeType?.startsWith('video/') && <video key={active.id} controls playsInline src={url} className="max-h-full max-w-full" />}
                {url && active.mimeType === 'application/pdf' && <iframe title={active.name} src={url} className="h-full w-full bg-white" />}
                {url && !image && !active.mimeType?.startsWith('video/') && active.mimeType !== 'application/pdf' && <a href={url} download={active.name} className="rounded-lg bg-violet-600 px-4 py-3 font-semibold">Скачать документ</a>}
            </div>
            {index < files.length - 1 && <button type="button" onClick={() => navigate(1)} aria-label="Следующий материал" className="absolute right-2 z-10 hidden rounded-full bg-black/60 px-3 py-3 text-xl sm:block">›</button>}
        </div>
        {showDetails && <div className="shrink-0 border-t border-white/15 bg-slate-900/95 px-4 py-2 text-sm">
            <p className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-slate-100">{active.caption || 'Без подписи'}</p>
            <p className="mt-1 text-xs text-slate-400">{(active.size / 1024 / 1024).toFixed(1)} МБ · {new Date(active.createdAt).toLocaleString('ru-RU')}</p>
        </div>}
        <nav aria-label="Миниатюры материалов" className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-white/15 px-3 py-2 pb-[max(10px,env(safe-area-inset-bottom))]">
            {files.map((file, position) => <button key={file.id} type="button" onClick={() => setIndex(position)} aria-label={`Открыть ${file.name}`} aria-current={index === position ? 'true' : undefined}
                className={`h-12 w-14 shrink-0 overflow-hidden rounded-lg border-2 text-xs transition-all duration-200 ${index === position ? 'border-violet-400 bg-violet-800' : 'border-slate-600 bg-slate-800 opacity-70'}`}>
                {urls[file.id] && file.mimeType?.startsWith('image/') ? <img src={urls[file.id]} alt="" className="h-full w-full object-cover" /> : file.mimeType?.startsWith('video/') ? '🎬' : file.mimeType === 'application/pdf' ? '📄' : '📎'}
            </button>)}
        </nav>
    </div>, document.body);
}
