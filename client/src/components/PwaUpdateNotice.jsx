import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

// A new version is available only when a new SW is actually WAITING.
// A page reload is not an update: we reload only after controllerchange.
export default function PwaUpdateNotice() {
    const [available, setAvailable] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');
    const registrationRef = useRef(null);
    const acceptingRef = useRef(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        let active = true;
        let cleanup = () => {};
        const refreshStatus = async () => {
            const registration = registrationRef.current || await navigator.serviceWorker.getRegistration();
            if (!active || !registration) return;
            registrationRef.current = registration;
            // A waiting SW must exist, and this page must already have an older
            // controller. The initial installation is not an update.
            const waiting = Boolean(registration.waiting && navigator.serviceWorker.controller);
            if (!acceptingRef.current) setAvailable(waiting);
        };
        registerSW({
            immediate: true,
            onNeedRefresh() { refreshStatus().catch(() => {}); },
            onRegisteredSW(_url, registration) {
                if (!active || !registration) return;
                registrationRef.current = registration;
                const check = () => {
                    if (navigator.onLine && document.visibilityState === 'visible') {
                        registration.update().catch(() => {});
                    }
                    refreshStatus().catch(() => {});
                };
                const onStateChange = () => refreshStatus().catch(() => {});
                registration.addEventListener('updatefound', onStateChange);
                document.addEventListener('visibilitychange', check);
                window.addEventListener('focus', check);
                window.addEventListener('online', check);
                const interval = window.setInterval(check, 15 * 60 * 1000);
                cleanup = () => {
                    registration.removeEventListener('updatefound', onStateChange);
                    document.removeEventListener('visibilitychange', check);
                    window.removeEventListener('focus', check);
                    window.removeEventListener('online', check);
                    clearInterval(interval);
                };
                check();
            },
        });
        refreshStatus().catch(() => {});
        return () => { active = false; cleanup(); };
    }, []);

    const acceptUpdate = async () => {
        if (acceptingRef.current) return;
        acceptingRef.current = true;
        setUpdating(true);
        setError('');
        try {
            const registration = registrationRef.current || await navigator.serviceWorker.getRegistration();
            const waiting = registration?.waiting;
            if (!waiting || !navigator.serviceWorker.controller) {
                throw new Error('Обновление больше не ожидает установки. Проверим наличие новой версии.');
            }
            const previousController = navigator.serviceWorker.controller;
            // Attach BEFORE sending the message, so we cannot miss activation.
            await new Promise((resolve, reject) => {
                let timer;
                const finish = (err) => {
                    clearTimeout(timer);
                    navigator.serviceWorker.removeEventListener('controllerchange', changed);
                    if (err) reject(err); else resolve();
                };
                const changed = () => {
                    if (navigator.serviceWorker.controller !== previousController) finish();
                };
                navigator.serviceWorker.addEventListener('controllerchange', changed);
                timer = setTimeout(() => finish(new Error('Не удалось активировать обновление. Попробуйте ещё раз.')), 12000);
                try { waiting.postMessage({ type: 'SKIP_WAITING' }); }
                catch (e) { finish(e); }
            });
            // In a new controller, navigation requests are handled by new assets.
            // No unconditional timer reload: that caused endless update loops.
            setAvailable(false);
            window.location.reload();
        } catch (e) {
            console.error('[PWA] update activation:', e);
            setError(e.message || 'Не удалось применить обновление.');
            setAvailable(true);
        } finally {
            acceptingRef.current = false;
            setUpdating(false);
        }
    };

    if (!available) return null;
    return (
        <div className="mrr-pwa-update-notice fixed z-[240] left-4 right-4 bottom-[calc(110px+env(safe-area-inset-bottom,0px))] md:bottom-6 md:left-auto md:right-6 md:max-w-sm rounded-2xl border border-violet-400/40 bg-[#191428]/95 backdrop-blur-xl shadow-2xl p-4 flex gap-3 items-center" role="status">
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Доступно обновление</div>
                <p className="text-xs text-white/60 mt-1">{updating ? 'Устанавливаем новую версию…' : 'Новая версия загружена. Обновите сайт, когда закончите редактирование.'}</p>
                {error && <p className="text-xs text-pink mt-2" role="alert">{error}</p>}
            </div>
            <button type="button" className="btn-primary text-sm shrink-0" onClick={acceptUpdate} disabled={updating}>{updating ? 'Обновляем…' : 'Обновить'}</button>
        </div>
    );
}
