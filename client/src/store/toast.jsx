import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        setItems((list) => list.filter((t) => t.id !== id));
        const tm = timers.current.get(id);
        if (tm) {
            clearTimeout(tm);
            timers.current.delete(id);
        }
    }, []);

    const push = useCallback(
        (message, { type = 'info', duration = 4000 } = {}) => {
            const id = nextId++;
            setItems((list) => {
                const next = [...list, { id, message, type }];
                return next.slice(-3);
            });
            if (duration > 0) {
                const tm = setTimeout(() => dismiss(id), duration);
                timers.current.set(id, tm);
            }
            return id;
        },
        [dismiss]
    );

    const api = {
        info: (msg, opts) => push(msg, { ...opts, type: 'info' }),
        success: (msg, opts) => push(msg, { ...opts, type: 'success' }),
        error: (msg, opts) => push(msg, { ...opts, type: 'error', duration: 6000 }),
        warn: (msg, opts) => push(msg, { ...opts, type: 'warn' }),
        dismiss,
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            {createPortal(<ToastStack items={items} onDismiss={dismiss} />, document.body)}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

const STYLE = {
    info: 'bg-white/10 border-white/20 text-white',
    success: 'bg-lime/15 border-lime/40 text-lime',
    error: 'bg-pink/15 border-pink/40 text-pink',
    warn: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
};

const ICON = {
    info: 'ℹ️',
    success: '✓',
    error: '⚠️',
    warn: '⚠️',
};

function ToastStack({ items, onDismiss }) {
    if (!items.length) return null;
    return (
        <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100vw-2.5rem)] sm:w-auto pointer-events-none">
            {items.map((t) => (
                <div
                    key={t.id}
                    className={`pointer-events-auto rounded-2xl border backdrop-blur-md px-4 py-3 shadow-lg flex items-start gap-3 animate-[slideIn_0.2s_ease-out] ${
                        STYLE[t.type] || STYLE.info
                    }`}
                >
                    <span className="text-lg shrink-0">{ICON[t.type] || ICON.info}</span>
                    <div className="flex-1 text-sm break-words whitespace-pre-line">
                        {t.message}
                    </div>
                    <button
                        onClick={() => onDismiss(t.id)}
                        className="text-white/40 hover:text-white text-sm shrink-0"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}