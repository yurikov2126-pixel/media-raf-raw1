import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export default function PwaUpdateNotice() {
    const [available, setAvailable] = useState(false);
    const [update, setUpdate] = useState(null);
    useEffect(() => {
        let active = true;
        let cleanup = () => {};
        const applyUpdate = registerSW({
            immediate: true,
            onNeedRefresh() { if (active) setAvailable(true); },
            onRegisteredSW(_url, registration) {
                if (!registration) return;
                const check = () => { if (navigator.onLine && document.visibilityState === 'visible') registration.update().catch(() => {}); };
                document.addEventListener('visibilitychange', check);
                window.addEventListener('focus', check);
                window.addEventListener('online', check);
                const interval = window.setInterval(check, 60 * 1000);
                cleanup = () => {
                    document.removeEventListener('visibilitychange', check);
                    window.removeEventListener('focus', check);
                    window.removeEventListener('online', check);
                    window.clearInterval(interval);
                };
                check();
            },
        });
        setUpdate(() => applyUpdate);
        return () => { active = false; cleanup(); };
    }, []);
    if (!available) return null;
    return (
        <div className="fixed z-[240] left-4 right-4 bottom-[calc(110px+env(safe-area-inset-bottom,0px))] md:bottom-6 md:left-auto md:right-6 md:max-w-sm rounded-2xl border border-violet-400/40 bg-[#191428]/95 backdrop-blur-xl shadow-2xl p-4 flex gap-3 items-center" role="status">
            <div className="flex-1 min-w-0"><div className="font-semibold text-sm">Доступно обновление</div><p className="text-xs text-white/60 mt-1">Новая версия готова. Обновите приложение, когда закончите редактирование.</p></div>
            <button type="button" className="btn-primary text-sm shrink-0" onClick={() => update?.(true)}>Обновить</button>
        </div>
    );
}
