import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
    getUserGamification,
    getLeaderboard,
    recordDailyActivity,
    getTodayQuests,
} from '../lib/gamification.js';
import { getSettings } from '../lib/gamificationSettings.js';
import {
    ACHIEVEMENTS,
    RARITY_COLORS,
    RARITY_LABEL,
    QUEST_TYPE_META,
} from '../lib/gamificationCatalog.js';

const router = Router();
router.use(auth);

router.get('/status', async (_req, res) => {
    const s = await getSettings();
    res.json({
        enabled: s.enabled,
        leaderboardEnabled: s.leaderboardEnabled,
        questsEnabled: s.questsEnabled,
        deductionsEnabled: s.deductionsEnabled,
    });
});

router.get('/me', async (req, res) => {
    try {
        const data = await getUserGamification(req.user.id);
        res.json(data);
    } catch (e) {
        console.error('[gamification] me error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/daily', async (req, res) => {
    try {
        const r = await recordDailyActivity(req.user.id);
        res.json(r);
    } catch (e) {
        console.error('[gamification] daily error:', e);
        res.status(500).json({ error: e.message });
    }
});

/* Квесты на сегодня */
router.get('/quests', async (req, res) => {
    try {
        const s = await getSettings();
        if (!s.enabled || !s.questsEnabled) {
            return res.json({ enabled: false, quests: [], questTypeMeta: {} });
        }
        const quests = await getTodayQuests(req.user.id);
        res.json({
            enabled: true,
            quests,
            questTypeMeta: QUEST_TYPE_META,
        });
    } catch (e) {
        console.error('[gamification] quests error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/user/:username', async (req, res) => {
    try {
        const u = await prisma.user.findUnique({
            where: { username: req.params.username },
            select: { id: true },
        });
        if (!u) return res.status(404).json({ error: 'Не найден' });
        const data = await getUserGamification(u.id);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const s = await getSettings();
        if (!s.enabled || !s.leaderboardEnabled) {
            return res.json({ items: [], period: 'all' });
        }
        const period = req.query.period === 'week' ? 'week' : 'all';
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const items = await getLeaderboard({ period, limit });
        res.json({ items, period });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/achievements/catalog', (_req, res) => {
    res.json({
        achievements: ACHIEVEMENTS,
        rarityColors: RARITY_COLORS,
        rarityLabel: RARITY_LABEL,
    });
});

export default router;