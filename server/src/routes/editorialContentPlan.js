import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const platforms = new Set(['VK', 'TELEGRAM', 'WEBSITE', 'OTHER']);
const statuses = new Set(['IDEA', 'IN_PROGRESS', 'REVIEW', 'READY', 'PUBLISHED']);
const canEdit = user => ['ADMIN', 'MENTOR'].includes(user.role);
const clean = body => {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const publishAt = typeof body.publishAt === 'string' ? new Date(body.publishAt) : new Date(NaN);
    if (!title || title.length > 160 || description.length > 2000 ||
        !platforms.has(body.platform) || !statuses.has(body.status) ||
        !Number.isFinite(publishAt.getTime())) return null;
    const assigneeId = body.assigneeId || null;
    if (assigneeId !== null && typeof assigneeId !== 'string') return null;
    return { title, description, platform: body.platform, status: body.status, publishAt, assigneeId };
};
router.get('/', async (req, res, next) => {
    try {
        const from = new Date(req.query.from);
        const to = new Date(req.query.to);
        if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
            to <= from || to - from > 370 * 86400000) return res.status(400).json({ error: 'Неверный диапазон дат' });
        const items = await prisma.editorialContentPlanItem.findMany({
            where: { publishAt: { gte: from, lt: to } },
            orderBy: [{ publishAt: 'asc' }, { createdAt: 'asc' }], take: 1000,
        });
        res.json({ items, canEdit: canEdit(req.user) });
    } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
    try {
        if (!canEdit(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
        const data = clean(req.body || {});
        if (!data) return res.status(400).json({ error: 'Проверьте поля публикации' });
        if (data.assigneeId) {
            const user = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { id: true } });
            if (!user) return res.status(400).json({ error: 'Ответственный не найден' });
        }
        const item = await prisma.editorialContentPlanItem.create({ data: { ...data, createdById: req.user.id } });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
    try {
        if (!canEdit(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
        const data = clean(req.body || {});
        if (!data) return res.status(400).json({ error: 'Проверьте поля публикации' });
        if (data.assigneeId) {
            const user = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { id: true } });
            if (!user) return res.status(400).json({ error: 'Ответственный не найден' });
        }
        const result = await prisma.editorialContentPlanItem.updateMany({ where: { id: req.params.id }, data });
        if (!result.count) return res.status(404).json({ error: 'Публикация не найдена' });
        const item = await prisma.editorialContentPlanItem.findUnique({ where: { id: req.params.id } });
        res.json({ item });
    } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
    try {
        if (!canEdit(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
        const result = await prisma.editorialContentPlanItem.deleteMany({ where: { id: req.params.id } });
        if (!result.count) return res.status(404).json({ error: 'Публикация не найдена' });
        res.status(204).end();
    } catch (error) { next(error); }
});
export default router;
