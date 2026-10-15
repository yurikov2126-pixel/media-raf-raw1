import { useRef } from 'react';

// Pointer Events work with mouse, touch and pen; avoid interfering with zoom/scroll.
export function usePhotoGestures({ onLeft, onRight, onDown, onLongPress }) {
    const start = useRef(null);
    const timer = useRef(null);
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    return {
        onPointerDown: event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            clear();
            start.current = { x:event.clientX,y:event.clientY,id:event.pointerId,time:Date.now(),type:event.pointerType,locked:false };
            if (onLongPress && event.pointerType !== 'mouse') timer.current = setTimeout(() => {
                if (start.current) { start.current.locked = true; onLongPress(event.clientX,event.clientY); }
            }, 550);
        },
        onPointerMove: event => {
            if (start.current && (Math.abs(event.clientX-start.current.x)>12 || Math.abs(event.clientY-start.current.y)>12)) clear();
        },
        onPointerUp: event => {
            clear();
            const origin = start.current; start.current = null;
            if (!origin || origin.locked || origin.id !== event.pointerId || origin.type === 'mouse') return;
            const dx = event.clientX-origin.x, dy = event.clientY-origin.y;
            if (Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.3) (dx<0?onLeft:onRight)?.();
            else if (dy>110 && Math.abs(dy)>Math.abs(dx)*1.4) onDown?.();
        },
        onPointerCancel: () => {clear();start.current=null;},
        onContextMenu: event => { if (!onLongPress) return; event.preventDefault(); onLongPress(event.clientX,event.clientY); },
    };
}
