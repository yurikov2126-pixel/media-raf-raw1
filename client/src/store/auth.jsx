import { createContext, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';

const Ctx = createContext(null);

export const useAuth = () => {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => {
        try { return localStorage.getItem('mrr_token'); }
        catch { return null; }
    });
    const [loading, setLoading] = useState(true);

    /* Загрузка пользователя по сохранённому токену.
       Удаляем токен ТОЛЬКО при явном 401 — иначе (сеть, 5xx)
       оставляем, чтобы при возврате связи авторизация сохранилась. */
    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        api('/auth/me', { token })
            .then(setUser)
            .catch((e) => {
                const isAuthError =
                    e instanceof ApiError
                        ? e.status === 401
                        : /401|Неверный токен|Нет токена|Доступ закрыт/i.test(e?.message || '');

                if (isAuthError) {
                    try { localStorage.removeItem('mrr_token'); } catch {}
                    setToken(null);
                    setUser(null);
                }
                // Сетевые ошибки молча игнорируем — пользователь остаётся
                // «в ожидании», при следующем запросе всё перепроверится.
            })
            .finally(() => setLoading(false));
    }, [token]);

    /* Сохранение токена и пользователя. */
    const applyAuth = (nextToken, nextUser) => {
        try { localStorage.setItem('mrr_token', nextToken); } catch {}
        setToken(nextToken);
        setUser(nextUser);
    };

    const logout = () => {
        try { localStorage.removeItem('mrr_token'); } catch {}
        setToken(null);
        setUser(null);
    };

    const register = async (payload) => {
        const r = await api('/auth/register', { method: 'POST', body: payload });
        applyAuth(r.token, r.user);
        return r;
    };

    const loginWithPassword = async (loginOrEmail, password) => {
        const r = await api('/auth/login', {
            method: 'POST',
            body: { login: loginOrEmail, password },
        });
        applyAuth(r.token, r.user);
        return r;
    };

    const value = {
        user,
        token,
        loading,
        register,
        loginWithPassword,
        logout,
        setUser,
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}