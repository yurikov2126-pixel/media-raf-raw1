import { useEffect } from 'react';

/**
 * Body overflow:hidden alone does not prevent iOS Safari from moving the page
 * underneath a fixed fullscreen viewer. Fix the body's position and restore the
 * exact scroll offset when the viewer closes.
 */
export function useEditorialViewerScrollLock(active) {
    useEffect(() => {
        if (!active) return undefined;
        const y = window.scrollY;
        const x = window.scrollX;
        const body = document.body;
        const saved = {
            position:body.style.position, top:body.style.top, left:body.style.left,
            right:body.style.right, width:body.style.width, overflow:body.style.overflow,
        };
        body.style.position = 'fixed';
        body.style.top = '-' + y + 'px';
        body.style.left = '-' + x + 'px';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        return () => {
            Object.assign(body.style,saved);
            window.scrollTo(x,y);
        };
    },[active]);
}
