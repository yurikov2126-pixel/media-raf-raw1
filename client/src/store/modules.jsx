import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './auth.jsx';

const Ctx = createContext(null);

export const useModules = () =>
    useContext(Ctx) || {
        modules: {},
        loading: false,
        isEnabled: () => true,
        reload: () => {},
    };

/* Маппинг URL → ключ модуля. Используется для фильтрации навигации
   и авто-редиректа с отключённых разделов. */
export function moduleKeyForPath(path) {
    if (!path) return null;
    if (path === '/app' || path === '/app/' || path.startsWith('/app/feed')) return 'feed';
    if (path.startsWith('/app/chats')) return 'chats';
    if (path.startsWith('/app/editorial')) return 'editorial';
    if (path.startsWith('/app/courses')) return 'courses';
    if (path.startsWith('/app/certificates')) return 'courses';
    if (path.startsWith('/app/wiki')) return 'wiki';
    return null;
}

export function ModulesProvider({ children }) {
    const { token, user } = useAuth();
    const [modules, setModules] = useState({});
    const [loading, setLoading] = useState(false);

    const reload = useCallback(async () => {
        if (!token || !user) {
            setModules({});
            return;
        }
        setLoading(true);
        try {
            const r = await api('/modules', { token });
            setModules(r.modules || {});
        } catch {
            // Если упало — считаем все модули включёнными,
            // чтобы не блокировать UI из-за временной ошибки.
            setModules({});
        } finally {
            setLoading(false);
        }
    }, [token, user?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    const isEnabled = useCallback(
        (key) => {
            if (!key) return true;
            // Пока состояние не загружено — считаем включённым
            if (Object.keys(modules).length === 0) return true;
            return modules[key] !== false;
        },
        [modules]
    );

    const value = useMemo(
        () => ({ modules, loading, isEnabled, reload }),
        [modules, loading, isEnabled, reload]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}