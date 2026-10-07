import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { sendPushToAll, sendPushToUser, sendPushToUsers } from '../../lib/push.js';
import {
    getPushCleanupSettings,
    cleanupInactivePushSubscriptions,
} from '../../lib/pushCleanup.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ PUSH-УВЕДОМЛЕНИЯ ═══════════ */

router.get(
    '/push/stats',
    safe(async (_req, res) => {
        const total = await prisma.pushSubscription.count();
        const uniqueUsers = await prisma.pushSubscription.groupBy({
            by: ['userId'],
        });
        const active7d = await prisma.pushSubscription.count({
            where: { lastUsed: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        res.json({
            totalSubscriptions: total,
            uniqueUsers: uniqueUsers.length,
            activeLast7Days: active7d,
        });
    })
);

router.get(
    '/push/subscriptions',
    safe(async (_req, res) => {
        const subs = await prisma.pushSubscription.findMany({
            orderBy: { lastUsed: 'desc' },
            include: {
                user: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(
            subs.map((s) => ({
                id: s.id,
                userId: s.userId,
                user: s.user,
                endpoint: s.endpoint.slice(0, 60) + '…',
                userAgent: s.userAgent,
                createdAt: s.createdAt,
                lastUsed: s.lastUsed,
            }))
        );
    })
);

router.post(
    '/push/send',
    safe(async (req, res) => {
        const { target, direction, courseId, group, userIds, title, body, url } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'title и body обязательны' });
        }

        const payload = { title, body, url: url || '/app', tag: `admin-${Date.now()}` };

        let userIdsResolved = [];

        if (target === 'all') {
            const rows = await prisma.user.findMany({
                where: { isBanned: false },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'direction') {
            if (!direction) return res.status(400).json({ error: 'Выберите направление' });
            const rows = await prisma.user.findMany({
                where: { isBanned: false, direction },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'course') {
            if (!courseId) return res.status(400).json({ error: 'Выберите курс' });
            const rows = await prisma.enrollment.findMany({
                where: { courseId },
                include: { user: { select: { id: true, isBanned: true } } },
            });
            userIdsResolved = rows.filter((e) => !e.user.isBanned).map((e) => e.user.id);
        } else if (target === 'group') {
            if (!group) return res.status(400).json({ error: 'Укажите группу' });
            const rows = await prisma.user.findMany({
                where: { isBanned: false, group },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'custom') {
            if (!Array.isArray(userIds) || userIds.length === 0)
                return res.status(400).json({ error: 'Выберите получателей' });
            userIdsResolved = userIds;
        } else {
            return res.status(400).json({ error: 'Неизвестная цель' });
        }

        if (userIdsResolved.length === 0)
            return res.status(400).json({ error: 'Нет получателей' });

        let result;
        if (target === 'all') {
            result = await sendPushToAll(payload);
        } else {
            result = await sendPushToUsers(userIdsResolved, payload);
        }

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_broadcast',
                payload: JSON.stringify({ target, title, recipients: userIdsResolved.length }),
                affected: result.sent,
            },
        });

        res.json({
            ok: true,
            recipients: userIdsResolved.length,
            sent: result.sent,
            failed: result.failed,
            gone: result.gone,
        });
    })
);

router.post(
    '/push/test-self',
    safe(async (req, res) => {
        const { title, body } = req.body;
        const r = await sendPushToUser(req.user.id, {
            title: title || 'Тест из админки',
            body: body || 'Пуш работает ✅',
            url: '/app',
            tag: `admin-test-${Date.now()}`,
        });
        res.json(r);
    })
);

/* ═══════════ УПРАВЛЕНИЕ PUSH-ПОДПИСКАМИ ═══════════ */

router.delete(
    '/push/subscriptions/:id',
    safe(async (req, res) => {
        const sub = await prisma.pushSubscription.findUnique({
            where: { id: req.params.id },
        });
        if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });

        await prisma.pushSubscription.delete({ where: { id: sub.id } });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscription_delete',
                payload: JSON.stringify({ subscriptionId: sub.id, userId: sub.userId }),
                affected: 1,
            },
        }).catch(() => {});

        res.json({ ok: true });
    })
);

router.post(
    '/push/subscriptions/delete-many',
    safe(async (req, res) => {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Пустой список' });
        }
        const clean = ids.filter((x) => typeof x === 'string' && x.length > 0);
        if (clean.length === 0) return res.status(400).json({ error: 'Нет валидных id' });

        const result = await prisma.pushSubscription.deleteMany({
            where: { id: { in: clean } },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscriptions_bulk_delete',
                payload: JSON.stringify({ count: clean.length }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, deleted: result.count });
    })
);

router.delete(
    '/push/subscriptions/user/:userId',
    safe(async (req, res) => {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, fullName: true },
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const result = await prisma.pushSubscription.deleteMany({
            where: { userId },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscriptions_user_delete',
                payload: JSON.stringify({ userId, fullName: user.fullName }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, deleted: result.count });
    })
);

/* ═══════════ АВТООЧИСТКА PUSH-ПОДПИСОК ═══════════ */

router.get(
    '/push/cleanup-settings',
    safe(async (_req, res) => {
        try {
            res.json(await getPushCleanupSettings());
        } catch (e) {
            console.error('[admin] cleanup-settings error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

router.post(
    '/push/cleanup-now',
    safe(async (req, res) => {
        const { dryRun } = req.body || {};
        try {
            const r = await cleanupInactivePushSubscriptions({
                dryRun: !!dryRun,
                trigger: 'manual-force',
            });

            if (!dryRun && r.deleted > 0) {
                await prisma.adminAction.create({
                    data: {
                        adminId: req.user.id,
                        action: 'push_subscriptions_cleanup',
                        payload: JSON.stringify({ days: r.days, deleted: r.deleted }),
                        affected: r.deleted,
                    },
                }).catch(() => {});
            }

            res.json(r);
        } catch (e) {
            console.error('[admin] cleanup-now error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

export default router;