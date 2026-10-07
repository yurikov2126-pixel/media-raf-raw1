import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
    adminResetUser,
    adminResetAll,
    adminGrantXp,
    getAdminOverview,
} from '../../lib/gamification.js';
import {
    getSettings as getGamifSettings,
    updateSettings as updateGamifSettings,
    listAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    resetAchievementsToDefaults,
} from '../../lib/gamificationSettings.js';
import {
    QUEST_TEMPLATES,
    XP_DEFAULTS,
    DEDUCTION_DEFAULTS,
    RARITIES,
    COUNTER_OPTIONS,
    DEFAULT_LEVEL_THRESHOLDS,
} from '../../lib/gamificationCatalog.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ ГЕЙМИФИКАЦИЯ ═══════════ */

router.get('/gamification/settings', safe(async (_req, res) => {
    res.json(await getGamifSettings());
}));

router.put('/gamification/settings', safe(async (req, res) => {
    const updated = await updateGamifSettings(req.body || {});
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_settings_update',
            payload: JSON.stringify(req.body || {}),
            affected: 1,
        },
    }).catch(() => {});
    res.json(updated);
}));

router.get('/gamification/overview', safe(async (_req, res) => {
    res.json(await getAdminOverview());
}));

router.get('/gamification/catalog', safe(async (_req, res) => {
    res.json({
        xpDefaults: XP_DEFAULTS,
        deductionDefaults: DEDUCTION_DEFAULTS,
        questTemplates: QUEST_TEMPLATES,
        rarities: RARITIES,
        counterOptions: COUNTER_OPTIONS,
        defaultLevels: DEFAULT_LEVEL_THRESHOLDS,
    });
}));

router.post('/gamification/grant-xp', safe(async (req, res) => {
    const { userId, amount, reason } = req.body;
    if (!userId || amount === undefined || Number(amount) === 0)
        return res.status(400).json({ error: 'userId и amount обязательны' });
    const r = await adminGrantXp(userId, Number(amount), reason || 'admin_grant');
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_grant_xp',
            payload: JSON.stringify({ userId, amount: Number(amount) }),
            affected: 1,
        },
    }).catch(() => {});
    res.json(r);
}));

router.post('/gamification/reset-user/:userId', safe(async (req, res) => {
    await adminResetUser(req.params.userId);
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_reset_user',
            payload: JSON.stringify({ userId: req.params.userId }),
            affected: 1,
        },
    }).catch(() => {});
    res.json({ ok: true });
}));

router.post('/gamification/reset-all', safe(async (req, res) => {
    await adminResetAll();
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_reset_all',
            payload: JSON.stringify({}),
            affected: 0,
        },
    }).catch(() => {});
    res.json({ ok: true });
}));

/* ─── Достижения ─── */

router.get('/gamification/achievements', safe(async (_req, res) => {
    res.json({ achievements: await listAchievements() });
}));

router.post('/gamification/achievements', safe(async (req, res) => {
    try {
        const a = await createAchievement(req.body || {});
        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'gamification_achievement_create',
                payload: JSON.stringify({ id: a.id, title: a.title }),
                affected: 1,
            },
        }).catch(() => {});
        res.json(a);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.patch('/gamification/achievements/:id', safe(async (req, res) => {
    try {
        const a = await updateAchievement(req.params.id, req.body || {});
        res.json(a);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.delete('/gamification/achievements/:id', safe(async (req, res) => {
    try {
        await deleteAchievement(req.params.id);
        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'gamification_achievement_delete',
                payload: JSON.stringify({ id: req.params.id }),
                affected: 1,
            },
        }).catch(() => {});
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.post('/gamification/achievements/reset-defaults', safe(async (_req, res) => {
    const list = await resetAchievementsToDefaults();
    res.json({ ok: true, achievements: list });
}));

/* ─── Уровни ─── */

router.get('/gamification/levels', safe(async (_req, res) => {
    const s = await getGamifSettings();
    res.json({
        thresholds: s.levelThresholds,
        defaultThresholds: DEFAULT_LEVEL_THRESHOLDS,
    });
}));

router.put('/gamification/levels', safe(async (req, res) => {
    const { thresholds } = req.body || {};
    if (!Array.isArray(thresholds))
        return res.status(400).json({ error: 'thresholds должен быть массивом' });
    const updated = await updateGamifSettings({ levelThresholds: thresholds });
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_levels_update',
            payload: JSON.stringify({ count: thresholds.length }),
            affected: 1,
        },
    }).catch(() => {});
    res.json({ ok: true, thresholds: updated.levelThresholds });
}));

router.post('/gamification/levels/reset-defaults', safe(async (_req, res) => {
    const updated = await updateGamifSettings({ levelThresholds: DEFAULT_LEVEL_THRESHOLDS });
    res.json({ ok: true, thresholds: updated.levelThresholds });
}));

/* ─── Шаблоны квестов ─── */

const QUEST_TYPES = [
    'post_count', 'comment_count', 'lesson_count',
    'test_pass', 'reaction_given', 'certificate_earned',
];

router.get('/gamification/quest-templates', safe(async (_req, res) => {
    const count = await prisma.questTemplate.count();
    if (count === 0) {
        await prisma.questTemplate.createMany({ data: QUEST_TEMPLATES });
    }
    const templates = await prisma.questTemplate.findMany({
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ templates, types: QUEST_TYPES });
}));

router.post('/gamification/quest-templates', safe(async (req, res) => {
    const { type, target, xpReward, label, icon, weight, active } = req.body || {};
    if (!type || !QUEST_TYPES.includes(type))
        return res.status(400).json({ error: 'Недопустимый тип квеста' });
    const created = await prisma.questTemplate.create({
        data: {
            type,
            target: Math.max(1, Math.min(100, Number(target) || 1)),
            xpReward: Math.max(1, Math.min(10000, Number(xpReward) || 10)),
            label: label ? String(label).slice(0, 100) : null,
            icon: icon ? String(icon).slice(0, 10) : null,
            weight: Math.max(1, Math.min(100, Number(weight) || 1)),
            active: active !== false,
        },
    });
    res.json(created);
}));

router.patch('/gamification/quest-templates/:id', safe(async (req, res) => {
    const { type, target, xpReward, label, icon, weight, active } = req.body || {};
    const data = {};
    if (type !== undefined) {
        if (!QUEST_TYPES.includes(type)) return res.status(400).json({ error: 'Недопустимый тип' });
        data.type = type;
    }
    if (target !== undefined) data.target = Math.max(1, Math.min(100, Number(target) || 1));
    if (xpReward !== undefined) data.xpReward = Math.max(1, Math.min(10000, Number(xpReward) || 1));
    if (label !== undefined) data.label = label ? String(label).slice(0, 100) : null;
    if (icon !== undefined) data.icon = icon ? String(icon).slice(0, 10) : null;
    if (weight !== undefined) data.weight = Math.max(1, Math.min(100, Number(weight) || 1));
    if (active !== undefined) data.active = !!active;
    res.json(await prisma.questTemplate.update({ where: { id: req.params.id }, data }));
}));

router.delete('/gamification/quest-templates/:id', safe(async (req, res) => {
    await prisma.questTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}));

router.post('/gamification/quest-templates/reset-defaults', safe(async (_req, res) => {
    await prisma.questTemplate.deleteMany({});
    await prisma.questTemplate.createMany({ data: QUEST_TEMPLATES });
    const templates = await prisma.questTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ ok: true, templates });
}));

router.post('/gamification/quests/regenerate-all', safe(async (req, res) => {
    const today = new Date();
    const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const del = await prisma.dailyQuest.deleteMany({ where: { date: todayKey } });
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_quests_regenerate_all',
            payload: JSON.stringify({ date: todayKey }),
            affected: del.count,
        },
    }).catch(() => {});
    res.json({ ok: true, deleted: del.count, date: todayKey });
}));

export default router;