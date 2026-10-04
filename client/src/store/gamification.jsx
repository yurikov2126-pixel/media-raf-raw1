import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from 'react';
import { api } from '../api/client.js';
import { useAuth } from './auth.jsx';
import { useSocket } from './socket.jsx';

const Ctx = createContext(null);

export const useGamification = () =>
    useContext(Ctx) || {
        enabled: false,
        stats: null,
        progress: null,
        achievements: [],
        quests: [],
        questTypeMeta: {},
        loading: false,
        reload: () => {},
        reloadQuests: () => {},
        toastQueue: [],
        dismissToast: () => {},
    };

export function GamificationProvider({ children }) {
    const { user, token } = useAuth();
    const socket = useSocket();
    const [enabled, setEnabled] = useState(false);
    const [questsEnabled, setQuestsEnabled] = useState(false);
    const [stats, setStats] = useState(null);
    const [progress, setProgress] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [quests, setQuests] = useState([]);
    const [questTypeMeta, setQuestTypeMeta] = useState({});
    const [loading, setLoading] = useState(false);
    const [toastQueue, setToastQueue] = useState([]);

    const reload = useCallback(async () => {
        if (!token || !user) return;
        setLoading(true);
        try {
            const status = await api('/gamification/status', { token });
            setEnabled(status.enabled);
            setQuestsEnabled(status.questsEnabled);
            if (status.enabled) {
                const me = await api('/gamification/me', { token });
                setStats(me.stats);
                setProgress(me.progress);
                setAchievements(me.achievements || []);
            }
        } catch (e) {
            console.error('[gamification] reload error:', e);
        } finally {
            setLoading(false);
        }
    }, [token, user?.id]);

    const reloadQuests = useCallback(async () => {
        if (!token || !user) return;
        try {
            const r = await api('/gamification/quests', { token });
            setQuests(r.quests || []);
            setQuestTypeMeta(r.questTypeMeta || {});
        } catch (e) {
            console.error('[gamification] quests error:', e);
        }
    }, [token, user?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        if (questsEnabled) reloadQuests();
    }, [questsEnabled, reloadQuests]);

    useEffect(() => {
        if (!socket) return;
        const onNotif = (n) => {
            if (n.type === 'level_up') {
                setToastQueue((q) => [
                    ...q,
                    { id: `lvl-${n.id}`, kind: 'level_up', level: n.payload?.level },
                ]);
                reload();
            } else if (n.type === 'achievement') {
                setToastQueue((q) => [
                    ...q,
                    {
                        id: `ach-${n.id}`,
                        kind: 'achievement',
                        achievement: {
                            id: n.payload?.achievementId,
                            title: n.payload?.title,
                            icon: n.payload?.icon,
                            rarity: n.payload?.rarity,
                        },
                    },
                ]);
                reload();
            } else if (n.type === 'xp_deduction') {
                setToastQueue((q) => [
                    ...q,
                    {
                        id: `ded-${n.id}`,
                        kind: 'deduction',
                        amount: n.payload?.amount,
                        reason: n.payload?.reason,
                    },
                ]);
                reload();
            }
        };
        socket.on('notification:new', onNotif);
        return () => socket.off('notification:new', onNotif);
    }, [socket, reload]);

    /* Перезагружаем квесты при новом сообщении — прогресс мог обновиться */
    useEffect(() => {
        if (!socket) return;
        const onMsg = () => reloadQuests();
        socket.on('message:new', onMsg);
        return () => socket.off('message:new', onMsg);
    }, [socket, reloadQuests]);

    const dismissToast = useCallback((id) => {
        setToastQueue((q) => q.filter((t) => t.id !== id));
    }, []);

    const value = useMemo(
        () => ({
            enabled,
            questsEnabled,
            stats,
            progress,
            achievements,
            quests,
            questTypeMeta,
            loading,
            reload,
            reloadQuests,
            toastQueue,
            dismissToast,
        }),
        [enabled, questsEnabled, stats, progress, achievements, quests, questTypeMeta, loading, reload, reloadQuests, toastQueue, dismissToast]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}