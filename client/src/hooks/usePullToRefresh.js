import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Pull-to-refresh для скроллируемого контейнера.
 *
 * Триггерится только когда:
 *   - пользователь тач-устройства
 *   - scrollTop === 0 (в самом верху)
 *   - палец тянет вниз
 *
 * Возвращает { pull, refreshing } — для отрисовки индикатора.
 */
const THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.5;

export default function usePullToRefresh({ ref, onRefresh, disabled = false }) {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const startYRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const pullingRef = useRef(false);

    const reset = useCallback(() => {
        startYRef.current = null;
        scrollContainerRef.current = null;
        pullingRef.current = false;
        setPull(0);
    }, []);

    const handleTouchStart = useCallback(
        (e) => {
            if (disabled || refreshing) return;
            const el = ref.current;
            if (!el || e.touches.length !== 1) return;
            const scrolling = el.closest('[data-scroll-container]') || document.scrollingElement;
            scrollContainerRef.current = scrolling;
            if (scrolling?.scrollTop > 0 || window.scrollY > 0) return;
            if (e.target.closest('textarea, input, select, [contenteditable="true"], [role="dialog"]')) return;
            startYRef.current = e.touches[0].clientY;
            pullingRef.current = false;
        },
        [disabled, refreshing, ref]
    );

    const handleTouchMove = useCallback(
        (e) => {
            if (startYRef.current === null || disabled || refreshing) return;
            const el = ref.current;
            if (!el) return;

            if ((scrollContainerRef.current?.scrollTop || 0) > 0 || window.scrollY > 0) {
                reset();
                return;
            }

            const dy = e.touches[0].clientY - startYRef.current;

            // Тянем вверх или палец чуть сдвинулся — не активируем
            if (dy <= 0) {
                if (!pullingRef.current) reset();
                return;
            }

            pullingRef.current = true;
            const next = Math.min(MAX_PULL, dy * RESISTANCE);
            setPull(next);

            // Не блокируем нативную прокрутку: iOS PWA может застрять при preventDefault.
        },
        [disabled, refreshing, ref, reset]
    );

    const handleTouchEnd = useCallback(async () => {
        if (startYRef.current === null) return;
        const shouldRefresh = pullingRef.current && pull >= THRESHOLD;
        reset();
        if (!shouldRefresh) return;

        setRefreshing(true);
        try {
            await onRefresh?.();
        } finally {
            setRefreshing(false);
        }
    }, [pull, onRefresh, reset]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: true });
        el.addEventListener('touchend', handleTouchEnd);
        el.addEventListener('touchcancel', reset);

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('touchcancel', reset);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, reset, ref]);

    return { pull, refreshing, threshold: THRESHOLD };
}