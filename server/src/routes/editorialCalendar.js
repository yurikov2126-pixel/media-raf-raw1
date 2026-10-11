import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);
const maxRange = 370 * 86400000;
const parseDate = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
};
function validate(body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const startsAt = parseDate(body.startsAt);
    const endsAt = parseDate(body.endsAt);
    if (!title || title.length > 160) return { error: 'Название должно содержать от 1 до 160 символов' };
    if (description.length > 2000) return { error: 'Описание слишком длинное' };
    if (!startsAt || !endsAt || endsAt <= startsAt) return { error: 'Укажите корректное начало и окончание события' };
    if (endsAt.getTime() - startsAt.getTime() > 31 * 86400000) return { error: 'Событие не может длиться более 31 дня' };
    if (typeof body.allDay !== 'boolean') return { error: 'Некорректное значение «Весь день»' };
    return { data: { title, description, startsAt, endsAt, allDay: body.allDay } };
}
router.get('/', async (req, res, next) => {
    try {
        const from = parseDate(req.query.from);
        const to = parseDate(req.query.to);
        if (!from || !to || to <= from || to - from > maxRange) return res.status(400).json({ error: 'Укажите корректный диапазон дат (до 370 дней)' });
        const events = await prisma.personalCalendarEvent.findMany({
            where: { ownerId: req.user.id, startsAt: { lt: to }, endsAt: { gt: from } },
            orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
            take: 1000,
        });
        res.json({ events });
    } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
    try {
        const result = validate(req.body || {});
        if (result.error) return res.status(400).json({ error: result.error });
        const event = await prisma.personalCalendarEvent.create({ data: { ...result.data, ownerId: req.user.id } });
        res.status(201).json({ event });
    } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const result = validate(req.body || {});
        if (result.error) return res.status(400).json({ error: result.error });
        const updated = await prisma.personalCalendarEvent.updateMany({
            where: { id: req.params.id, ownerId: req.user.id }, data: result.data,
        });
        if (!updated.count) return res.status(404).json({ error: 'Событие не найдено' });
        const event = await prisma.personalCalendarEvent.findFirst({ where: { id: req.params.id, ownerId: req.user.id } });
        res.json({ event });
    } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const result = await prisma.personalCalendarEvent.deleteMany({ where: { id: req.params.id, ownerId: req.user.id } });
        if (!result.count) return res.status(404).json({ error: 'Событие не найдено' });
        res.status(204).end();
    } catch (error) { next(error); }
});
export default router;
