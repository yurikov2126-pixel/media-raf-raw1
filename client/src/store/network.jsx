import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { ping as pingApi } from '../api/client.js';

const Ctx = createContext(null);

export const useNetwork = () => {
    const v = useContext(Ctx);
    if (!v) throw new Error('useNetwork must be used inside <NetworkProvider>');
    return v;
};

const PING_INTERVAL_MS = 5000;

export function NetworkProvider({ children }) {
    // Начальное состояние — синхронный navigator.onLine.
    // Он не всегда врёт в одну сторону, но сигнал «браузер точно знает,
    // что сети нет» — надёжный стартовый якорь.
    const [isOffline, setIsOffline] = useState(() => {
        if (typeof navigator === 'undefined') return false;
        return navigator.onLine === false;
    });

    const timerRef = useRef(null);

    const runPing = useCallback(async () => {
        const ok = await pingApi();
        setIsOffline(!ok);
        return ok;
    }, []);

    /* Браузерные события. offline — верим сразу, online — перепроверяем
       пингом: navigator.onLine часто врёт (VPN, captive portal, локальная
       сеть без выхода в интернет). */
    useEffect(() => {
        const onOffline = () => setIsOffline(true);
        const onOnline = () => { runPing(); };

        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
        };
    }, [runPing]);

    /* События от api/client.js. Это — основной канал: он ловит не только
       физический обрыв, но и ситуации «интернет есть, а до сервера не достучаться»
       (VPN, DNS, CORS, упавший бэкенд). */
    useEffect(() => {
        const onErr = () => setIsOffline(true);
        const onOk = () => setIsOffline(false);

        window.addEventListener('mrr:network-error', onErr);
        window.addEventListener('mrr:network-ok', onOk);
        return () => {
            window.removeEventListener('mrr:network-error', onErr);
            window.removeEventListener('mrr:network-ok', onOk);
        };
    }, []);

    /* iOS may restore a cached PWA with navigator.onLine === true even
       though the API is unreachable. Verify connectivity on cold start and
       whenever the app returns to foreground. */
    useEffect(() => {
        let lastCheck = 0;
        const check = () => {
            if (document.visibilityState === 'hidden') return;
            const now = Date.now();
            if (now - lastCheck < 3000) return;
            lastCheck = now;
            runPing();
        };
        check();
        document.addEventListener('visibilitychange', check);
        window.addEventListener('pageshow', check);
        return () => {
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('pageshow', check);
        };
    }, [runPing]);

    /* While the app is visible, probe the API periodically even if the
       browser still reports online. iOS PWA often misses offline events. */
    useEffect(() => {
        const probe = () => {
            if (document.visibilityState === 'visible' && !isOffline) runPing();
        };
        const id = window.setInterval(probe, 12000);
        return () => window.clearInterval(id);
    }, [isOffline, runPing]);

    /* Пока считаем, что офлайн — периодически пингуем.
       Первый пинг почти сразу, дальше — раз в PING_INTERVAL_MS.
       Так мы восстанавливаемся даже если браузер не стрельнул `online`. */
    useEffect(() => {
        if (!isOffline) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return;
        }
        const first = setTimeout(runPing, 1200);
        timerRef.current = setInterval(runPing, PING_INTERVAL_MS);
        return () => {
            clearTimeout(first);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [isOffline, runPing]);

    const value = useMemo(
        () => ({
            isOffline,
            online: !isOffline,
            retry: runPing,
        }),
        [isOffline, runPing]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}