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

// Resolve even older review notifications that contain only an assignment ID.
router.get('/learning-target', auth, async (req, res) => {
    const { homeworkId, practicalId } = req.query;
    if ((!homeworkId && !practicalId) || (homeworkId && practicalId)) {
        return res.status(400).json({ error: 'Укажите одно задание' });
    }
    try {
        if (homeworkId) {
            const submission = await prisma.homeworkSubmission.findUnique({
                where: { homeworkId_userId: { homeworkId: String(homeworkId), userId: req.user.id } },
                select: { homework: { select: { lesson: { select: { order: true, course: { select: { slug: true } } } } } } },
            });
            if (!submission) return res.status(404).json({ error: 'Домашнее задание не найдено' });
            return res.json({ courseSlug: submission.homework.lesson.course.slug, lessonOrder: submission.homework.lesson.order, kind: 'homework' });
        }
        const submission = await prisma.practicalSubmission.findUnique({
            where: { practicalId_userId: { practicalId: String(practicalId), userId: req.user.id } },
            select: { practical: { select: { lesson: { select: { order: true } }, course: { select: { slug: true } } } } },
        });
        if (!submission) return res.status(404).json({ error: 'Практическая работа не найдена' });
        return res.json({ courseSlug: submission.practical.course.slug, lessonOrder: submission.practical.lesson?.order ?? null, kind: 'practical' });
    } catch (error) {
        console.error('[notification learning-target]', error);
        res.status(500).json({ error: 'Не удалось открыть задание' });
    }
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