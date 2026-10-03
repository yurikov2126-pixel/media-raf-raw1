import { useEffect, useRef, useState } from 'react';

const SWIPE_X_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;
const SWIPE_Y_THRESHOLD = 100;
const CLOSE_VELOCITY = 0.6;
const AXIS_LOCK_PX = 12;
const MAX_BACKDROP_DRAG = 1;

export default function ImageViewer({ images, startIndex = 0, onClose }) {
    const [index, setIndex] = useState(startIndex);
    const [dragX, setDragX] = useState(0);
    const [dragY, setDragY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [closing, setClosing] = useState(false);
    const [showHint, setShowHint] = useState(true);

    const startXRef = useRef(null);
    const startYRef = useRef(null);
    const startTimeRef = useRef(0);
    const axisRef = useRef(null);

    useEffect(() => {
        setShowHint(true);
        const t = setTimeout(() => setShowHint(false), 2500);
        return () => clearTimeout(t);
    }, [index]);

    useEffect(() => {
        const onKey = (e) => {
            if (closing) return;
            if (e.key === 'Escape') closeWithAnimation(0);
            if (e.key === 'ArrowLeft')
                setIndex((i) => (i - 1 + images.length) % images.length);
            if (e.key === 'ArrowRight')
                setIndex((i) => (i + 1) % images.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length, closing]);

    const prev = (e) => {
        e?.stopPropagation();
        setIndex((i) => (i - 1 + images.length) % images.length);
    };
    const next = (e) => {
        e?.stopPropagation();
        setIndex((i) => (i + 1) % images.length);
    };

    const closeWithAnimation = (direction) => {
        if (closing) return;
        setClosing(true);
        setDragY(direction > 0 ? 600 : -600);
        setDragX(0);
        setTimeout(() => onClose?.(), 200);
    };

    /* ─── Жесты ─── */

    const onTouchStart = (e) => {
        if (closing) return;
        if (e.touches.length !== 1) return;
        startXRef.current = e.touches[0].clientX;
        startYRef.current = e.touches[0].clientY;
        startTimeRef.current = performance.now();
        axisRef.current = null;
        setDragging(true);
    };

    const onTouchMove = (e) => {
        if (!dragging || closing) return;
        if (e.touches.length !== 1) return;
        if (startXRef.current === null || startYRef.current === null) return;

        const dx = e.touches[0].clientX - startXRef.current;
        const dy = e.touches[0].clientY - startYRef.current;

        if (!axisRef.current) {
            if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
            axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            setShowHint(false);
        }

        if (axisRef.current === 'x') {
            if (images.length <= 1) return;
            const isEdge =
                (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1);
            setDragX(isEdge ? dx * 0.35 : dx);
        } else if (axisRef.current === 'y') {
            const limited = Math.max(0, dy);
            const eased = limited < 300 ? limited : 300 + (limited - 300) * 0.4;
            setDragY(eased);
            if (e.cancelable) e.preventDefault();
        }
    };

    const onTouchEnd = () => {
        if (!dragging || closing) {
            setDragging(false);
            return;
        }

        const dt = Math.max(1, performance.now() - startTimeRef.current);
        const axis = axisRef.current;

        if (axis === 'x') {
            const velocity = Math.abs(dragX) / dt;
            const fast = velocity > SWIPE_VELOCITY && Math.abs(dragX) > 20;
            const far = Math.abs(dragX) > SWIPE_X_THRESHOLD;
            if ((far || fast) && dragX < 0 && index < images.length - 1) next();
            else if ((far || fast) && dragX > 0 && index > 0) prev();
        } else if (axis === 'y') {
            const velocity = dragY / dt;
            const far = dragY > SWIPE_Y_THRESHOLD;
            const fast = velocity > CLOSE_VELOCITY && dragY > 40;
            if (far || fast) {
                closeWithAnimation(1);
                return;
            }
        }

        setDragX(0);
        setDragY(0);
        setDragging(false);
        axisRef.current = null;
        startXRef.current = null;
        startYRef.current = null;
    };

    if (!images.length) return null;
    const current = images[index];

    const backdropOpacity = closing
        ? 0
        : Math.max(MAX_BACKDROP_DRAG - dragY / 600, 0.35);

    const scale = 1 - Math.min(0.25, dragY / 1200);

    const transition = dragging
        ? 'none'
        : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';

    return (
        <div
            className="mrr-iv"
            style={{
                backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
                transition: dragging ? 'none' : 'background-color 220ms ease-out',
            }}
            onClick={onClose}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
        >
            {/* ─── Шапка ─── */}
            <div className="mrr-iv__header" onClick={(e) => e.stopPropagation()}>
                <div className="mrr-iv__counter">
                    {index + 1} / {images.length}
                </div>

                {/* ПК: большая кнопка «Закрыть · Esc» */}
                <button
                    onClick={onClose}
                    className="mrr-iv__close-desktop"
                    aria-label="Закрыть просмотрщик"
                    title="Закрыть (Esc)"
                >
                    <span className="mrr-iv__close-x">✕</span>
                    <span>Закрыть</span>
                    <span className="mrr-iv__kbd">Esc</span>
                </button>

                {/* Мобильные: компактный крестик */}
                <button
                    onClick={onClose}
                    className="mrr-iv__close-mobile"
                    aria-label="Закрыть"
                >
                    ✕
                </button>
            </div>

            {/* ─── Основная область ─── */}
            <div className="mrr-iv__stage" onClick={(e) => e.stopPropagation()}>
                {images.length > 1 && (
                    <button
                        onClick={prev}
                        className="mrr-iv__nav mrr-iv__nav--left"
                        aria-label="Предыдущее"
                    >
                        ‹
                    </button>
                )}

                <img
                    src={current.url}
                    alt=""
                    draggable={false}
                    className="mrr-iv__img"
                    style={{
                        transform: `translate(${dragX}px, ${dragY}px) scale(${scale})`,
                        transition,
                        opacity: closing ? 0 : 1,
                    }}
                    onClick={(e) => e.stopPropagation()}
                />

                {images.length > 1 && (
                    <button
                        onClick={next}
                        className="mrr-iv__nav mrr-iv__nav--right"
                        aria-label="Следующее"
                    >
                        ›
                    </button>
                )}
            </div>

            {/* ─── Точки-индикаторы ─── */}
            {images.length > 1 && images.length <= 12 && !closing && (
                <div
                    className="mrr-iv__dots"
                    onClick={(e) => e.stopPropagation()}
                >
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            className={`mrr-iv__dot ${i === index ? 'is-active' : ''}`}
                            aria-label={`Перейти к ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* ─── Подсказка ─── */}
            <div
                className={`mrr-iv__hint-wrap ${
                    showHint && !dragging && !closing ? 'is-visible' : ''
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mrr-iv__hint">
                    <span className="mrr-iv__hint-mobile">
                        ↕ Свайп вниз — закрыть · ←→ — листать
                    </span>
                    <span className="mrr-iv__hint-desktop">
                        <span>
                            <span className="mrr-iv__kbd">←→</span> листать
                        </span>
                        <span className="mrr-iv__hint-sep">·</span>
                        <span>
                            <span className="mrr-iv__kbd">Esc</span> закрыть
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
}