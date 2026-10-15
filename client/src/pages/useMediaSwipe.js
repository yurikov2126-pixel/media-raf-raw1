import { useRef } from 'react';

/**
 * One-finger viewer gestures: horizontal swipe navigates, downward swipe closes.
 * Ignore gestures starting in controls or scrollable descriptions.
 */
export function useMediaSwipe({ onPrevious, onNext, onClose }) {
    const origin = useRef(null);
    return {
        onTouchStart: event => {
            if (event.touches.length !== 1 || event.target.closest('button, a, input, select, textarea, video, [data-swipe-ignore]')) { origin.current = null; return; }
            const point = event.touches[0];
            origin.current = { x:point.clientX, y:point.clientY, time:Date.now() };
        },
        onTouchEnd: event => {
            if (!origin.current || event.changedTouches.length !== 1) return;
            const point = event.changedTouches[0];
            const dx = point.clientX - origin.current.x;
            const dy = point.clientY - origin.current.y;
            const duration = Date.now() - origin.current.time;
            origin.current = null;
            if (duration > 900) return;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                if (dx > 0) onPrevious(); else onNext();
            } else if (dy > 105 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose();
        },
        onTouchCancel: () => { origin.current = null; },
    };
}
