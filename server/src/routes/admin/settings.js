import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { notifyBroadcast } from '../../lib/notify.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ НАСТРОЙКИ ═══════════ */
router.get(
    '/settings',
    safe(async (_req, res) => {
        const settings = await prisma.setting.findMany();
        res.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
    })
);

router.put(
    '/settings',
    safe(async (req, res) => {
        const entries = Object.entries(req.body);
        await Promise.all(entries.map(([key, value]) =>
            prisma.setting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            })
        ));
        res.json({ ok: true });
    })
);

/* ═══════════ РАССЫЛКИ ═══════════ */
router.post(
    '/broadcast',
    safe(async (req, res) => {
        const { target, message, title, direction, courseId, group, userIds } = req.body;
        if (!message?.trim())
            return res.status(400).json({ error: 'Введите текст рассылки' });

        let users = [];
        if (target === 'all') {
            users = await prisma.user.findMany({ where: { isBanned: false }, select: { id: true } });
        } else if (target === 'direction') {
            if (!direction) return res.status(400).json({ error: 'Выберите направление' });
            users = await prisma.user.findMany({
                where: { isBanned: false, direction }, select: { id: true },
            });
        } else if (target === 'course') {
            if (!courseId) return res.status(400).json({ error: 'Выберите курс' });
            const enrollments = await prisma.enrollment.findMany({
                where: { courseId },
                include: { user: { select: { id: true, isBanned: true } } },
            });
            users = enrollments.filter((e) => !e.user.isBanned).map((e) => ({ id: e.user.id }));
        } else if (target === 'group') {
            if (!group) return res.status(400).json({ error: 'Укажите группу' });
            users = await prisma.user.findMany({
                where: { isBanned: false, group }, select: { id: true },
            });
        } else if (target === 'custom') {
            if (!Array.isArray(userIds) || userIds.length === 0)
                return res.status(400).json({ error: 'Выберите получателей' });
            users = await prisma.user.findMany({
                where: { id: { in: userIds }, isBanned: false }, select: { id: true },
            });
        } else {
            return res.status(400).json({ error: 'Неизвестная цель' });
        }

        if (!users.length) return res.status(400).json({ error: 'Нет получателей' });

        const payload = {
            title: title?.trim() || 'Сообщение от администрации',
            message: message.trim(),
            fromName: req.user.fullName,
            broadcastAt: new Date().toISOString(),
        };
        await Promise.all(users.map((u) => notifyBroadcast(u.id, payload)));
        res.json({ ok: true, delivered: users.length });
    })
);

router.get(
    '/groups',
    safe(async (_req, res) => {
        const rows = await prisma.user.findMany({
            where: { group: { not: null } },
            select: { group: true },
            distinct: ['group'],
        });
        res.json(rows.map((r) => r.group).filter(Boolean).sort());
    })
);

export default router;