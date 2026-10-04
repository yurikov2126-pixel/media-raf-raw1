/**
 * Глобальный счётчик открытых модалок.
 * Используется, чтобы временно отключить свайп-навигацию в Layout,
 * пока открыт любой оверлей/модалка.
 *
 * Работает без реакт-контекста, чтобы не тянуть лишние зависимости
 * в компоненты, которые могут быть вне Router.
 */

let count = 0;
const listeners = new Set();

function emit() {
    const open = count > 0;
    for (const fn of listeners) {
        try { fn(open); } catch {}
    }
}

export function pushModal() {
    count++;
    if (count === 1) emit();
    return () => {
        count = Math.max(0, count - 1);
        if (count === 0) emit();
    };
}

export function isAnyModalOpen() {
    return count > 0;
}

export function subscribeModalState(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}