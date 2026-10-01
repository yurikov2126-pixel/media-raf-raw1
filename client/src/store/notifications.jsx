import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './auth.jsx';
import { useSocket } from './socket.jsx';
import { getPushState, subscribePush, unsubscribePush } from '../lib/push.js';

const Ctx = createContext(null);
export const useNotifications = () => useContext(Ctx) || {
    items: [], unread: 0, pushState: { supported: false },
};

export function NotificationsProvider({ children }) {
    const { token, user } = useAuth();
    const socket = useSocket();
    const [items, setItems] = useState([]);
    const [pushState, setPushState] = useState({ supported: false });

    const reload = useCallback(async () => {
        if (!token) { setItems([]); return; }
        try { setItems(await api('/notifications', { token })); } catch {}
    }, [token]);

    useEffect(() => { reload(); }, [reload]);

    // Проверяем состояние push при загрузке
    useEffect(() => {
        if (!user) return;
        getPushState().then(setPushState).catch(() => {});
    }, [user]);

    useEffect(() => {
        if (!socket) return;
        const onNew = (n) => {
            setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
        };
        socket.on('notification:new', onNew);
        return () => socket.off('notification:new', onNew);
    }, [socket]);

    const enablePush = useCallback(async () => {
        const r = await subscribePush(token);
        if (!r.ok) return r;
        const state = await getPushState();
        setPushState(state);
        return { ok: true };
    }, [token]);

    const disablePush = useCallback(async () => {
        await unsubscribePush(token);
        const state = await getPushState();
        setPushState(state);
        return { ok: true };
    }, [token]);

    const markAllRead = async () => {
        if (!token) return;
        await api('/notifications/read-all', { method: 'POST', token });
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    };

    const markRead = async (id) => {
        if (!token) return;
        await api(`/notifications/${id}/read`, { method: 'POST', token });
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    };

    const markChatRead = async (chatId) => {
        if (!token) return;
        await api(`/notifications/read-chat/${chatId}`, { method: 'POST', token });
        setItems((prev) =>
            prev.map((n) => {
                if (n.type !== 'message' || n.readAt) return n;
                return n.payload?.chatId === chatId
                    ? { ...n, readAt: new Date().toISOString() }
                    : n;
            })
        );
    };

    const remove = async (id) => {
        if (!token) return;
        await api(`/notifications/${id}`, { method: 'DELETE', token });
        setItems((prev) => prev.filter((n) => n.id !== id));
    };

    const unread = items.filter((n) => !n.readAt).length;

    return (
        <Ctx.Provider value={{
            items, unread, pushState,
            enablePush, disablePush,
            markAllRead, markRead, markChatRead, remove, reload,
        }}>
            {children}
        </Ctx.Provider>
    );
}