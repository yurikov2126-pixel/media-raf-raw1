import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const platforms = new Set(['VK', 'TELEGRAM', 'WEBSITE', 'OTHER']);
const statuses = new Set(['IDEA', 'IN_PROGRESS', 'REVIEW', 'READY', 'PUBLISHED']);
const canEdit = user => ['ADMIN', 'MENTOR'].includes(user.role);
const personSelect = { id: true, fullName: true, username: true, avatar: true };
const assigneeIds = async () => {
    const members = await prisma.editorialProjectMember.findMany({ select: { userId: true }, distinct: ['userId'] });
    return members.map(member => member.userId);
};
const validateAssignee = async id => {
    if (!id) return true;
    const [member, user] = await Promise.all([
        prisma.editorialProjectMember.findFirst({ where: { userId: id }, select: { id: true } }),
        prisma.user.findUnique({ where: { id }, select: { id: true, isBanned: true } }),
    ]);
    return !!member && !!user && !user.isBanned;
};
router.get('/assignees', async (req, res, next) => {
    try {
        const ids = await assigneeIds();
        const users = await prisma.user.findMany({
            where: { id: { in: ids }, isBanned: false },
            select: personSelect,
            orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
            take: 1000,
        });
        res.json({ users });
    } catch (error) { next(error); }
});
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
        const users = await prisma.user.findMany({
            where: { id: { in: [...new Set(items.map(item => item.assigneeId).filter(Boolean))] } },
            select: personSelect,
        });
        const people = new Map(users.map(user => [user.id, user]));
        res.json({ items: items.map(item => ({ ...item, assignee: people.get(item.assigneeId) || null })), canEdit: canEdit(req.user) });
    } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
    try {
        if (!canEdit(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
        const data = clean(req.body || {});
        if (!data) return res.status(400).json({ error: 'Проверьте поля публикации' });
        if (!(await validateAssignee(data.assigneeId))) return res.status(400).json({ error: 'Выберите участника редакционного проекта' });
        const item = await prisma.editorialContentPlanItem.create({ data: { ...data, createdById: req.user.id } });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
    try {
        if (!canEdit(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
        const data = clean(req.body || {});
        if (!data) return res.status(400).json({ error: 'Проверьте поля публикации' });
        if (!(await validateAssignee(data.assigneeId))) return res.status(400).json({ error: 'Выберите участника редакционного проекта' });
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
