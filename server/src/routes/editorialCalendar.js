import { randomUUID } from 'node:crypto';
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

const REPEAT = new Set(['NONE', 'DAILY', 'WEEKLY', 'WEEKDAYS', 'MONTHLY']);
function repeatPayload(body) {
    const repeat = body.repeat ?? 'NONE';
    if (!REPEAT.has(repeat)) return { error: 'Некорректный тип повторения' };
    if (repeat === 'NONE') return { repeat, until: null };
    if (typeof body.repeatUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.repeatUntil)) return { error: 'Укажите дату окончания повторения' };
    const until = parseDate(body.repeatUntil + 'T23:59:59.999Z');
    if (!until) return { error: 'Некорректная дата окончания повторения' };
    return { repeat, until };
}
function zoneParts(date, zone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const get = type => Number(parts.find(part => part.type === type).value);
    return { year: get('year'), month: get('month'), day: get('day'),
        hour: get('hour'), minute: get('minute'), second: get('second') };
}
function localToInstant(local, zone) {
    const target = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    let instant = target;
    for (let i = 0; i < 5; i++) {
        const actual = zoneParts(new Date(instant), zone);
        const seen = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
        const delta = target - seen;
        if (!delta) return new Date(instant);
        instant += delta;
    }
    // Nonexistent local times (DST spring-forward) are rejected instead of silently shifting.
    return null;
}
function occurrences(data, repeat, until, zone = 'UTC') {
    if (repeat === 'NONE') return [{ ...data }];
    const origin = data.startsAt;
    if (until < origin || until - origin > 366 * 86400000) return null;
    const duration = data.endsAt - origin;
    const list = [];
    const local = zoneParts(origin, zone);
    const originalDay = local.day;
    const firstMonth = local.month;
    const firstYear = local.year;
    for (let step = 0; step < 367; step++) {
        let year = firstYear, month = firstMonth, day = originalDay;
        if (repeat === 'MONTHLY') {
            const monthDate = new Date(Date.UTC(firstYear, firstMonth - 1 + step, 1));
            year = monthDate.getUTCFullYear();
            month = monthDate.getUTCMonth() + 1;
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            day = Math.min(originalDay, lastDay);
        } else {
            const offset = step * (repeat === 'WEEKLY' ? 7 : 1);
            const dayDate = new Date(Date.UTC(firstYear, firstMonth - 1, originalDay + offset));
            year = dayDate.getUTCFullYear();
            month = dayDate.getUTCMonth() + 1;
            day = dayDate.getUTCDate();
        }
        const localDate = { ...local, year, month, day };
        const startsAt = localToInstant(localDate, zone);
        if (!startsAt) continue;
        if (startsAt > until) break;
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
        if (repeat === 'WEEKDAYS' && (weekday === 0 || weekday === 6)) continue;
        list.push({ ...data, startsAt, endsAt: new Date(startsAt.getTime() + duration) });
    }
    return list.length && list.length <= 366 ? list : null;
}
function recurrenceZone(body) {
    const zone = body.timeZone || 'UTC';
    if (typeof zone !== 'string' || zone.length > 100) return null;
    try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; }
    catch { return null; }
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
        const recurrence = repeatPayload(req.body || {});
        if (recurrence.error) return res.status(400).json({ error: recurrence.error });
        const zone = recurrenceZone(req.body || {});
        if (!zone) return res.status(400).json({ error: 'Некорректный часовой пояс' });
        const instances = occurrences(result.data, recurrence.repeat, recurrence.until, zone);
        if (!instances) return res.status(400).json({ error: 'Повторение должно завершаться в течение года' });
        const seriesId = recurrence.repeat === 'NONE' ? null : randomUUID();
        const event = await prisma.$transaction(async tx => {
            if (seriesId) {
                await tx.personalCalendarEvent.createMany({ data: instances.map(instance => ({ ...instance, ownerId: req.user.id, seriesId })) });
                return tx.personalCalendarEvent.findFirst({ where: { ownerId: req.user.id, seriesId }, orderBy: { startsAt: 'asc' } });
            }
            return tx.personalCalendarEvent.create({ data: { ...result.data, ownerId: req.user.id } });
        });
        res.status(201).json({ event, created: instances.length });
    } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const result = validate(req.body || {});
        if (result.error) return res.status(400).json({ error: result.error });
        if (req.body.scope === 'series') {
            const existing = await prisma.personalCalendarEvent.findFirst({ where: { id: req.params.id, ownerId: req.user.id } });
            if (!existing) return res.status(404).json({ error: 'Событие не найдено' });
            if (!existing.seriesId) return res.status(400).json({ error: 'Событие не является повторяющимся' });
            const recurrence = repeatPayload(req.body || {});
            if (recurrence.error) return res.status(400).json({ error: recurrence.error });
            if (recurrence.repeat === 'NONE') return res.status(400).json({ error: 'Для серии выберите повторение' });
            const instances = occurrences(result.data, recurrence.repeat, recurrence.until);
            if (!instances) return res.status(400).json({ error: 'Повторение должно завершаться в течение года' });
            const event = await prisma.$transaction(async tx => {
                await tx.personalCalendarEvent.deleteMany({ where: { ownerId: req.user.id, seriesId: existing.seriesId } });
                await tx.personalCalendarEvent.createMany({ data: instances.map(instance => ({ ...instance, ownerId: req.user.id, seriesId: existing.seriesId })) });
                return tx.personalCalendarEvent.findFirst({ where: { ownerId: req.user.id, seriesId: existing.seriesId }, orderBy: { startsAt: 'asc' } });
            });
            return res.json({ event, updated: instances.length });
        }
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
        const existing = await prisma.personalCalendarEvent.findFirst({ where: { id: req.params.id, ownerId: req.user.id } });
        if (!existing) return res.status(404).json({ error: 'Событие не найдено' });
        const where = req.query.scope === 'series' && existing.seriesId
            ? { ownerId: req.user.id, seriesId: existing.seriesId }
            : { id: req.params.id, ownerId: req.user.id };
        const result = await prisma.personalCalendarEvent.deleteMany({ where });
        if (!result.count) return res.status(404).json({ error: 'Событие не найдено' });
        res.status(204).end();
    } catch (error) { next(error); }
});
export default router;
