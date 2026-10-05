import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pushModal } from '../lib/modalStack.js';

/* ─────── Пороги жестов ─────── */
const SWIPE_X_THRESHOLD = 60;        // px — сколько нужно протащить, чтобы сменить фото
const SWIPE_X_VELOCITY = 0.4;        // px/ms — быстрое движение тоже считается
const SWIPE_DOWN_THRESHOLD = 110;    // px — сколько нужно протащить вниз, чтобы закрыть
const SWIPE_DOWN_VELOCITY = 0.55;    // px/ms
const TAP_MAX_MOVE = 10;             // px — тап vs свайп
const TAP_MAX_TIME = 250;            // мс
const DOUBLE_TAP_DELAY = 280;        // мс
const AXIS_LOCK = 8;                 // px — после какого смещения фиксируем ось
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SLIDE_MS = 200;                // длительность анимации смены фото

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function ImageViewer({ images = [], startIndex = 0, onClose }) {
    const total = images.length;
    const [index, setIndex] = useState(startIndex);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [zoom, setZoom] = useState(1);

    const stageRef = useRef(null);       // контейнер, который трансформируется при свайпе
    const backdropRef = useRef(null);    // затемнение, гаснет при свайпе вниз
    const imgRef = useRef(null);         // само изображение — для зума и пана
    const pendingSlideRef = useRef(null); // -1 | 1 — направление слайда при смене index

    const drag = useRef({
        active: false, pinch: false, hadPinch: false,
        startX: 0, startY: 0, startTime: 0,
        lastX: 0, lastY: 0, lastTime: 0,
        vx: 0, vy: 0,
        axis: null,          // null | 'x' | 'y' | 'pinch'
        panX: 0, panY: 0,    // текущий сдвиг изображения (когда zoom > 1)
        panStartX: 0, panStartY: 0,
        pinchStartDist: 0, pinchStartZoom: 1,
    });

    const tap = useRef({ lastTime: 0, lastX: 0, lastY: 0, singleTimer: null });

    /* Синхронизация с внешним startIndex */
    useEffect(() => { setIndex(startIndex); }, [startIndex]);

    /* Блокируем скролл body + регистрируемся в стеке модалок */
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const release = pushModal();
        return () => {
            document.body.style.overflow = prevOverflow;
            release();
        };
    }, []);

    /* Обработка смены index: сброс зума, слайд-анимация */
    useEffect(() => {
        setImgLoaded(false);
        setZoom(1);
        drag.current.panX = 0;
        drag.current.panY = 0;

        const img = imgRef.current;
        if (img) {
            img.style.transition = 'none';
            img.style.transformOrigin = '50% 50%';
            img.style.transform = 'translate3d(0,0,0) scale(1)';
        }

        const el = stageRef.current;
        if (el && pendingSlideRef.current != null) {
            const dir = pendingSlideRef.current;
            pendingSlideRef.current = null;
            el.style.transition = 'none';
            el.style.transform = `translate3d(${dir * window.innerWidth}px, 0, 0)`;
            void el.offsetWidth;  // force reflow
            el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
            el.style.transform = 'translate3d(0,0,0)';
        } else if (el) {
            el.style.transition = 'none';
            el.style.transform = 'translate3d(0,0,0)';
        }

        const bd = backdropRef.current;
        if (bd) {
            bd.style.transition = 'none';
            bd.style.opacity = '1';
        }
    }, [index]);

    /* Предзагрузка соседних изображений */
    useEffect(() => {
        [index - 1, index + 1].forEach((i) => {
            if (i >= 0 && i < total) {
                const im = new Image();
                im.src = images[i].url;
            }
        });
    }, [index, total, images]);

    /* ───── Навигация ───── */
    const goPrev = useCallback(() => {
        if (total <= 1 || index === 0) return;
        pendingSlideRef.current = -1;
        setIndex((i) => i - 1);
    }, [total, index]);

    const goNext = useCallback(() => {
        if (total <= 1 || index === total - 1) return;
        pendingSlideRef.current = 1;
        setIndex((i) => i + 1);
    }, [total, index]);

    const goTo = useCallback((i) => {
        if (i === index || i < 0 || i >= total) return;
        pendingSlideRef.current = i > index ? 1 : -1;
        setIndex(i);
    }, [index, total]);

    /* Клавиатура */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
            else if (e.key === '0') {
                setZoom(1);
                drag.current.panX = 0;
                drag.current.panY = 0;
                const img = imgRef.current;
                if (img) {
                    img.style.transformOrigin = '50% 50%';
                    img.style.transition = 'transform 0.22s ease';
                    img.style.transform = 'translate3d(0,0,0) scale(1)';
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, goPrev, goNext]);

    /* ───── Хелперы для inline-стилей ───── */
    const setStage = (x, y, scale, transition = false, ms = SLIDE_MS) => {
        const el = stageRef.current;
        if (!el) return;
        el.style.transition = transition
            ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : 'none';
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    };
    const setBackdrop = (opacity, transition = false) => {
        const el = backdropRef.current;
        if (!el) return;
        el.style.transition = transition ? 'opacity 0.2s ease' : 'none';
        el.style.opacity = String(opacity);
    };
    const setImg = (x, y, scale, transition = false) => {
        const el = imgRef.current;
        if (!el) return;
        el.style.transition = transition
            ? 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none';
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    };

    /* ───── Touch-обработчики ───── */
    const onTouchStart = (e) => {
        const touches = e.touches;

        if (touches.length === 2) {
            const [a, b] = touches;
            drag.current.pinch = true;
            drag.current.hadPinch = true;
            drag.current.pinchStartDist =
                Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
            drag.current.pinchStartZoom = zoom;
            drag.current.axis = 'pinch';
            return;
        }

        const t = touches[0];
        if (!t) return;
        drag.current.active = true;
        drag.current.startX = t.clientX;
        drag.current.startY = t.clientY;
        drag.current.lastX = t.clientX;
        drag.current.lastY = t.clientY;
        drag.current.startTime = performance.now();
        drag.current.lastTime = performance.now();
        drag.current.vx = 0;
        drag.current.vy = 0;
        drag.current.axis = null;
        drag.current.panStartX = drag.current.panX;
        drag.current.panStartY = drag.current.panY;
    };

    const onTouchMove = (e) => {
        const touches = e.touches;

        /* Pinch */
        if (drag.current.pinch && touches.length === 2) {
            const [a, b] = touches;
            const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const ratio = dist / drag.current.pinchStartDist;
            const nz = clamp(drag.current.pinchStartZoom * ratio, ZOOM_MIN, ZOOM_MAX);
            setZoom(nz);
            setImg(drag.current.panX, drag.current.panY, nz);
            return;
        }

        if (!drag.current.active) return;
        const t = touches[0];
        if (!t) return;

        const now = performance.now();
        const dx = t.clientX - drag.current.startX;
        const dy = t.clientY - drag.current.startY;
        const dt = now - drag.current.lastTime;
        if (dt > 0) {
            drag.current.vx = (t.clientX - drag.current.lastX) / dt;
            drag.current.vy = (t.clientY - drag.current.lastY) / dt;
        }
        drag.current.lastX = t.clientX;
        drag.current.lastY = t.clientY;
        drag.current.lastTime = now;

        /* Фиксация оси (горизонталь или вертикаль) */
        if (drag.current.axis === null) {
            if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
            drag.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }

        /* Пан внутри увеличенного изображения */
        if (zoom > 1.02 && drag.current.axis === 'x') {
            const nx = drag.current.panStartX + dx;
            const ny = drag.current.panStartY + dy;
            drag.current.panX = nx;
            drag.current.panY = ny;
            setImg(nx, ny, zoom);
            return;
        }

        /* Горизонтальный свайп — смена фото с «резинкой» на краях */
        if (drag.current.axis === 'x') {
            let tx = dx;
            if ((index === 0 && dx > 0) || (index === total - 1 && dx < 0)) {
                tx = dx * 0.32;
            }
            setStage(tx, 0, 1);
        } else if (drag.current.axis === 'y') {
            const ty = Math.max(0, dy);
            const scale = 1 - Math.min(0.35, ty / 1200);
            const opacity = 1 - Math.min(0.85, ty / 450);
            setStage(0, ty, scale);
            setBackdrop(opacity);
        }
    };

    const finishPinch = () => {
        drag.current.pinch = false;
        drag.current.axis = null;
        if (zoom < 1.03) {
            setZoom(1);
            drag.current.panX = 0;
            drag.current.panY = 0;
            setImg(0, 0, 1, true);
        } else {
            setImg(drag.current.panX, drag.current.panY, zoom, true);
        }
    };

    const onTouchEnd = (e) => {
        /* Конец пинча */
        if (drag.current.pinch) {
            if (e.touches.length < 2) finishPinch();
            if (e.touches.length === 0) {
                drag.current.hadPinch = false;
                drag.current.active = false;
            }
            return;
        }

        /* Если был пинч, но теперь все пальцы отпущены — не считаем это тапом */
        if (drag.current.hadPinch && e.touches.length === 0) {
            drag.current.hadPinch = false;
            drag.current.active = false;
            return;
        }

        if (!drag.current.active) return;
        drag.current.active = false;

        const now = performance.now();
        const dx = drag.current.lastX - drag.current.startX;
        const dy = drag.current.lastY - drag.current.startY;
        const dt = now - drag.current.startTime;
        const vx = drag.current.vx;
        const vy = drag.current.vy;

        const moved = Math.abs(dx) > TAP_MAX_MOVE || Math.abs(dy) > TAP_MAX_MOVE;
        const quick = dt < TAP_MAX_TIME;

        /* Тап / двойной тап */
        if (!moved && quick && drag.current.axis === null) {
            handleTap(drag.current.startX, drag.current.startY);
            return;
        }

        /* Горизонтальный свайп */
        if (drag.current.axis === 'x') {
            const vFast = Math.abs(vx) > SWIPE_X_VELOCITY;
            const far = Math.abs(dx) > SWIPE_X_THRESHOLD;
            const wantNext = (dx < 0 && (far || (vFast && vx < 0))) && index < total - 1;
            const wantPrev = (dx > 0 && (far || (vFast && vx > 0))) && index > 0;

            if (wantNext) {
                setStage(-window.innerWidth, 0, 1, true, SLIDE_MS);
                setTimeout(() => {
                    pendingSlideRef.current = 1;
                    setIndex((i) => i + 1);
                }, SLIDE_MS - 20);
                return;
            }
            if (wantPrev) {
                setStage(window.innerWidth, 0, 1, true, SLIDE_MS);
                setTimeout(() => {
                    pendingSlideRef.current = -1;
                    setIndex((i) => i - 1);
                }, SLIDE_MS - 20);
                return;
            }
            /* Снап обратно */
            setStage(0, 0, 1, true);
            return;
        }

        /* Вертикальный свайп вниз — закрыть */
        if (drag.current.axis === 'y') {
            const vFast = vy > SWIPE_DOWN_VELOCITY;
            const far = dy > SWIPE_DOWN_THRESHOLD;
            if ((far || vFast) && zoom === 1) {
                setStage(0, window.innerHeight, 0.6, true);
                setBackdrop(0, true);
                setTimeout(() => onClose?.(), SLIDE_MS);
                return;
            }
            setStage(0, 0, 1, true);
            setBackdrop(1, true);
            return;
        }

        /* Fallback */
        setStage(0, 0, 1, true);
        setBackdrop(1, true);
    };

    /* ───── Тап и двойной тап ───── */
    const handleTap = (x, y) => {
        const now = performance.now();
        const withinDouble =
            now - tap.current.lastTime < DOUBLE_TAP_DELAY &&
            Math.abs(x - tap.current.lastX) < 40 &&
            Math.abs(y - tap.current.lastY) < 40;

        if (withinDouble) {
            if (tap.current.singleTimer) {
                clearTimeout(tap.current.singleTimer);
                tap.current.singleTimer = null;
            }
            tap.current.lastTime = 0;

            const img = imgRef.current;
            if (!img) return;

            if (zoom > 1.03) {
                setZoom(1);
                drag.current.panX = 0;
                drag.current.panY = 0;
                img.style.transformOrigin = '50% 50%';
                setImg(0, 0, 1, true);
            } else {
                const rect = img.getBoundingClientRect();
                const ox = ((x - rect.left) / rect.width) * 100;
                const oy = ((y - rect.top) / rect.height) * 100;
                img.style.transformOrigin = `${clamp(ox, 0, 100)}% ${clamp(oy, 0, 100)}%`;
                setZoom(DOUBLE_TAP_ZOOM);
                setImg(0, 0, DOUBLE_TAP_ZOOM, true);
            }
            return;
        }

        tap.current.lastTime = now;
        tap.current.lastX = x;
        tap.current.lastY = y;

        if (tap.current.singleTimer) clearTimeout(tap.current.singleTimer);
        tap.current.singleTimer = setTimeout(() => {
            tap.current.singleTimer = null;
            setChromeVisible((v) => !v);
        }, DOUBLE_TAP_DELAY);
    };

    if (!total) return null;
    const current = images[clamp(index, 0, total - 1)];
    if (!current) return null;

    const canNav = total > 1;

    return createPortal(
        <div
            className="fixed inset-0 z-[200] select-none overflow-hidden"
            style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
            onContextMenu={(e) => e.preventDefault()}
            role="dialog"
            aria-modal="true"
        >
            {/* Затемнение */}
            <div
                ref={backdropRef}
                className="absolute inset-0 bg-black/95 backdrop-blur-sm"
            />

            {/* Сцена — трансформируется при свайпе */}
            <div
                ref={stageRef}
                className="absolute inset-0 will-change-transform"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
            >
                <div className="absolute inset-0 flex items-center justify-center p-4 md:p-12">
                    {!imgLoaded && (
                        <div className="absolute inset-0 grid place-items-center pointer-events-none">
                            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                        </div>
                    )}
                    <img
                        ref={imgRef}
                        key={current.id}
                        src={current.url}
                        alt=""
                        draggable={false}
                        className="max-w-full max-h-full object-contain will-change-transform"
                        style={{
                            transformOrigin: '50% 50%',
                            opacity: imgLoaded ? 1 : 0,
                            transition: 'opacity 0.15s ease',
                        }}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(true)}
                    />
                </div>
            </div>

            {/* Верхняя панель */}
            <div
                className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-200 ${
                    chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                <div className="text-white/80 text-sm tabular-nums shrink-0">
                    {index + 1} / {total}
                </div>
                <div className="flex items-center gap-1">
                    {zoom > 1.03 && (
                        <button
                            onClick={() => {
                                setZoom(1);
                                drag.current.panX = 0;
                                drag.current.panY = 0;
                                const img = imgRef.current;
                                if (img) img.style.transformOrigin = '50% 50%';
                                setImg(0, 0, 1, true);
                            }}
                            className="w-10 h-10 grid place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/10 text-lg transition"
                            aria-label="Сбросить масштаб"
                            title="Сбросить масштаб (0)"
                        >
                            ⌗
                        </button>
                    )}
                    <a
                        href={current.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="w-10 h-10 grid place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/10 text-lg transition"
                        aria-label="Скачать"
                        title="Скачать"
                    >
                        ⬇
                    </a>
                    {typeof navigator !== 'undefined' && !!navigator.share && (
                        <button
                            onClick={async () => {
                                try { await navigator.share({ url: current.url }); } catch {}
                            }}
                            className="w-10 h-10 grid place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/10 text-lg transition"
                            aria-label="Поделиться"
                            title="Поделиться"
                        >
                            ⎋
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-10 h-10 grid place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xl transition"
                        aria-label="Закрыть"
                        title="Закрыть (Esc)"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Стрелки на десктопе */}
            {canNav && chromeVisible && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        disabled={index === 0}
                        className="hidden md:grid absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 place-items-center rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white text-2xl transition z-10"
                        aria-label="Предыдущее"
                    >
                        ‹
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        disabled={index === total - 1}
                        className="hidden md:grid absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 place-items-center rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white text-2xl transition z-10"
                        aria-label="Следующее"
                    >
                        ›
                    </button>
                </>
            )}

            {/* Точки-индикаторы (если ≤ 15 фото) */}
            {canNav && total <= 15 && (
                <div
                    className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 z-10 transition-opacity duration-200 ${
                        chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {images.map((img, i) => (
                        <button
                            key={img.id}
                            onClick={() => goTo(i)}
                            className={`rounded-full transition-all ${
                                i === index
                                    ? 'w-5 h-1.5 bg-white'
                                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                            }`}
                            aria-label={`Перейти к ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>,
        document.body
    );
}