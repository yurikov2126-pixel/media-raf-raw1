import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
    const items = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    res.json(items.map((n) => ({ ...n, payload: JSON.parse(n.payload || '{}') })));
});

router.get('/unread-count', auth, async (req, res) => {
    const count = await prisma.notification.count({
        where: { userId: req.user.id, readAt: null },
    });
    res.json({ count });
});

router.post('/read-all', auth, async (req, res) => {
    const r = await prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
    });
    res.json({ ok: true, updated: r.count });
});

router.post('/:id/read', auth, async (req, res) => {
    await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { readAt: new Date() },
    });
    res.json({ ok: true });
});

// Пометить все уведомления по чату прочитанными
router.post('/read-chat/:chatId', auth, async (req, res) => {
    const list = await prisma.notification.findMany({
        where: { userId: req.user.id, type: 'message', readAt: null },
    });
    const ids = list
        .filter((n) => {
            try {
                return JSON.parse(n.payload || '{}').chatId === req.params.chatId;
            } catch {
                return false;
            }
        })
        .map((n) => n.id);
    if (ids.length) {
        await prisma.notification.updateMany({
            where: { id: { in: ids } },
            data: { readAt: new Date() },
        });
    }
    res.json({ ok: true });
});

/* ─────────── Массовая очистка ─────────── */

/* Удалить все ПРОЧИТАННЫЕ уведомления текущего пользователя */
router.delete('/read', auth, async (req, res) => {
    const r = await prisma.notification.deleteMany({
        where: { userId: req.user.id, readAt: { not: null } },
    });
    res.json({ ok: true, deleted: r.count });
});

/* Удалить ВСЕ уведомления текущего пользователя */
router.delete('/all', auth, async (req, res) => {
    const r = await prisma.notification.deleteMany({
        where: { userId: req.user.id },
    });
    res.json({ ok: true, deleted: r.count });
});

/* Удалить конкретное уведомление */
router.delete('/:id', auth, async (req, res) => {
    await prisma.notification.deleteMany({
        where: { id: req.params.id, userId: req.user.id },
    });
    res.json({ ok: true });
});

export default router;