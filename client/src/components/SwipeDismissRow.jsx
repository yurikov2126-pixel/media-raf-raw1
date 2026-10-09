import { useRef, useState } from 'react';

/**
 * Shared touch-only swipe action. Keeps the action hidden under an opaque,
 * theme-aware card until the user deliberately drags left.
 */
export default function SwipeDismissRow({ children, onDismiss, onOpen, className = '' }) {
    const gesture = useRef(null);
    const suppressClick = useRef(false);
    const [offset, setOffset] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const start = (e) => {
        if (busy || e.touches.length !== 1) return;
        gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: null, dx: 0 };
        suppressClick.current = false;
    };
    const move = (e) => {
        const g = gesture.current;
        if (!g || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - g.x;
        const dy = e.touches[0].clientY - g.y;
        if (!g.mode && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
            g.mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
        }
        if (g.mode !== 'horizontal') return;
        g.dx = dx;
        suppressClick.current = true;
        setOffset(Math.max(-120, Math.min(0, dx)));
    };
    const end = async () => {
        const g = gesture.current;
        gesture.current = null;
        if (!g || g.mode !== 'horizontal') return;
        if (g.dx > -85) {
            setOffset(0);
            return;
        }
        setBusy(true);
        setOffset(-120);
        try {
            await onDismiss();
        } catch {
            setError('Не удалось удалить уведомление');
            setOffset(0);
        } finally {
            setBusy(false);
        }
    };
    const cancel = () => {
        gesture.current = null;
        setOffset(0);
    };
    const open = () => {
        if (suppressClick.current || busy) {
            suppressClick.current = false;
            return;
        }
        onOpen?.();
    };

    return (
        <div className="relative overflow-hidden" style={{ background: 'var(--bg-elev-1)' }}>
            <div
                className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden whitespace-nowrap text-sm font-semibold text-white"
                style={{
                    width: Math.max(0, -offset) + 'px',
                    background: '#db345a',
                    opacity: Math.min(1, Math.max(0, -offset) / 50),
                    transition: gesture.current?.mode === 'horizontal' ? 'none' : 'width 180ms ease, opacity 180ms ease',
                }}
                aria-hidden="true"
            >
                <span className="shrink-0">🗑 Удалить</span>
            </div>
            <div
                className={className}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
                onTouchCancel={cancel}
                onClick={open}
                style={{
                    position: 'relative',
                    background: 'var(--bg-elev-1)',
                    color: 'var(--text-primary)',
                    transform: `translate3d(${offset}px, 0, 0)`,
                    transition: gesture.current?.mode === 'horizontal' ? 'none' : 'transform 180ms ease',
                    touchAction: 'pan-y',
                }}
            >
                {children}
            </div>
            {error && <div role="alert" className="px-3 py-1 text-xs text-rose-500">{error}</div>}
        </div>
    );
}
