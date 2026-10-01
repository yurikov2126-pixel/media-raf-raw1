import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './auth.jsx';

const Ctx = createContext({ socket: null, onlineUsers: new Set() });
export const useSocket = () => useContext(Ctx).socket;
export const useOnlineUsers = () => useContext(Ctx).onlineUsers;

export function SocketProvider({ children }) {
    const { token } = useAuth();
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(() => new Set());

    useEffect(() => {
        if (!token) {
            setSocket(null);
            setOnlineUsers(new Set());
            return;
        }
        const s = io(import.meta.env.VITE_SOCKET || 'http://localhost:4000', {
            auth: { token },
        });
        setSocket(s);

        s.on('user:online', ({ userId }) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.add(userId);
                return next;
            });
        });
        s.on('user:offline', ({ userId }) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        });
        s.on('users:online', ({ ids }) => {
            setOnlineUsers(new Set(ids));
        });

        // Запросим список онлайн при подключении
        s.on('connect', () => {
            s.emit('users:online', (res) => {
                if (res?.ids) setOnlineUsers(new Set(res.ids));
            });
        });

        return () => s.disconnect();
    }, [token]);

    return (
        <Ctx.Provider value={{ socket, onlineUsers }}>{children}</Ctx.Provider>
    );
}