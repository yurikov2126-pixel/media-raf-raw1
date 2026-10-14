import { validatedCompetencyIds } from '../competencies.js';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { notifyNewLesson } from '../../lib/notificationEvents.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ КУРСЫ ═══════════ */
router.get(
    '/courses',
    safe(async (_req, res) => {
        const courses = await prisma.course.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                    include: {
                        test: { include: { questions: true } },
                        practical: {
                            include: {
                                supervisor: { select: { id: true, fullName: true, username: true } },
                            },
                        },
                        homework: true,
                    },
                },
            },
        });
        res.json(courses);
    })
);

router.get(
    '/courses/:id',
    safe(async (req, res) => {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                    include: {
                        test: { include: { questions: true } },
                        practical: {
                            include: {
                                supervisor: { select: { id: true, fullName: true, username: true } },
                            },
                        },
                        homework: true,
                    },
                },
            },
        });
        if (!course) return res.status(404).json({ error: 'Курс не найден' });
        res.json(course);
    })
);

router.post(
    '/courses',
    safe(async (req, res) => {
        const {
            title, slug, description, category, level, cover, published,
            certificateTitle, certificateDescription, competencyIds = [],
            dripMode, dripInterval, weeklyLessonLimit,
        } = req.body;
        if (!title || !slug)
            return res.status(400).json({ error: 'title и slug обязательны' });

        const course = await prisma.course.create({
            data: {
                title, slug,
                description: description || '',
                category: category || 'photo',
                level: level || 'beginner',
                cover: cover || null,
                published: !!published,
                certificateTitle: certificateTitle || 'Сертификат о прохождении курса',
                certificateDescription: certificateDescription || null,
                competencyIds: await validatedCompetencyIds(competencyIds),
                dripMode: dripMode || null,
                dripInterval: dripInterval ? Number(dripInterval) : null,
                weeklyLessonLimit: weeklyLessonLimit ? Number(weeklyLessonLimit) : null,
            },
        });
        res.json(course);
    })
);

router.patch(
    '/courses/:id',
    safe(async (req, res) => {
        const allowed = [
            'title', 'slug', 'description', 'category', 'level', 'cover',
            'published', 'certificateTitle', 'certificateDescription',
        ];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] === undefined) continue;
            if (k === 'published') {
                if (typeof req.body.published !== 'boolean')
                    return res.status(400).json({ error: 'published должен быть boolean' });
                data.published = req.body.published;
            } else if (k === 'cover' || k === 'certificateDescription') {
                data[k] = req.body[k] || null;
            } else {
                data[k] = req.body[k];
            }
        }
        if (data.slug !== undefined && !/^[a-z0-9-]+$/.test(data.slug))
            return res.status(400).json({ error: 'Некорректный slug курса' });
        if (data.title !== undefined && !String(data.title).trim())
            return res.status(400).json({ error: 'Название курса не может быть пустым' });

        // Course drip settings are editable after creation too (including turning drip off).
        if (req.body.dripMode !== undefined || req.body.dripInterval !== undefined || req.body.weeklyLessonLimit !== undefined) {
            const existing = await prisma.course.findUnique({
                where: { id: req.params.id },
                select: { dripMode: true, dripInterval: true, weeklyLessonLimit: true },
            });
            if (!existing) return res.status(404).json({ error: 'Курс не найден' });
            const mode = req.body.dripMode !== undefined ? (req.body.dripMode || null) : existing.dripMode;
            if (mode !== null && !['test', 'test_homework', 'test_weekly', 'schedule'].includes(mode)) {
                return res.status(400).json({ error: 'Неизвестный дрип-режим' });
            }
            const interval = req.body.dripInterval !== undefined ? req.body.dripInterval : existing.dripInterval;
            const weekly = req.body.weeklyLessonLimit !== undefined ? req.body.weeklyLessonLimit : existing.weeklyLessonLimit;
            const validPositive = v => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365;
            if (mode === 'schedule' && !validPositive(interval)) {
                return res.status(400).json({ error: 'Интервал открытия уроков должен быть от 1 до 365 дней' });
            }
            if (mode === 'test_weekly' && !validPositive(weekly)) {
                return res.status(400).json({ error: 'Количество уроков в неделю должно быть от 1 до 365' });
            }
            data.dripMode = mode;
            data.dripInterval = mode === 'schedule' ? Number(interval) : null;
            data.weeklyLessonLimit = mode === 'test_weekly' ? Number(weekly) : null;
        }
        if (req.body.competencyIds !== undefined) data.competencyIds = await validatedCompetencyIds(req.body.competencyIds);
        const course = await prisma.course.update({
            where: { id: req.params.id },
            data,
        });
        res.json(course);
    })
);

router.delete(
    '/courses/:id',
    safe(async (req, res) => {
        await prisma.course.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ УРОКИ ═══════════ */
router.post(
    '/courses/:courseId/lessons',
    safe(async (req, res) => {
        const { title, content, videoUrl, order, duration } = req.body;
        if (!title) return res.status(400).json({ error: 'title обязателен' });
        const lesson = await prisma.lesson.create({
            data: {
                courseId: req.params.courseId, title,
                content: content || '', videoUrl: videoUrl || null,
                order: order ?? 0, duration: duration ?? 0,
            },
        });

        // Уведомляем всех записанных (не блокирует ответ)
        notifyNewLesson({
            courseId: req.params.courseId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonOrder: lesson.order,
        }).catch((e) => console.error('[admin] notify lesson:', e));

        res.json(lesson);
    })
);

router.patch(
    '/lessons/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'content', 'videoUrl', 'order', 'duration'];
        const data = {};
        for (const key of allowed)
            if (req.body[key] !== undefined) data[key] = req.body[key];
        const lesson = await prisma.lesson.update({ where: { id: req.params.id }, data });
        res.json(lesson);
    })
);

router.delete(
    '/lessons/:id',
    safe(async (req, res) => {
        await prisma.lesson.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ТЕСТЫ ═══════════ */
router.post(
    '/lessons/:lessonId/test',
    safe(async (req, res) => {
        const { title, passScore } = req.body;
        const test = await prisma.test.create({
            data: {
                lessonId: req.params.lessonId,
                title: title || 'Тест', passScore: passScore ?? 70,
            },
        });
        res.json(test);
    })
);

router.patch(
    '/tests/:id',
    safe(async (req, res) => {
        const { title, passScore } = req.body;
        const test = await prisma.test.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(passScore !== undefined && { passScore }),
            },
        });
        res.json(test);
    })
);

router.delete(
    '/tests/:id',
    safe(async (req, res) => {
        await prisma.test.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ВОПРОСЫ ═══════════ */
const QUESTION_TYPES = ['single', 'multiple', 'matching', 'text', 'order'];

function validateQuestionPayload(type, p) {
    p = p || {};
    if (type === 'single') {
        if (!Array.isArray(p.options) || p.options.length < 2) throw new Error('single: options ≥ 2');
        if (typeof p.correct !== 'number') throw new Error('single: correct обязателен');
    } else if (type === 'multiple') {
        if (!Array.isArray(p.options) || p.options.length < 2) throw new Error('multiple: options ≥ 2');
        if (!Array.isArray(p.correct) || p.correct.length === 0) throw new Error('multiple: correct[] обязателен');
    } else if (type === 'matching') {
        if (!Array.isArray(p.left) || !Array.isArray(p.right)) throw new Error('matching: left/right обязательны');
        if (!Array.isArray(p.pairs) || p.pairs.length === 0) throw new Error('matching: pairs обязательны');
    } else if (type === 'text') {
        if (typeof p.answer !== 'string' || !p.answer.trim()) throw new Error('text: answer обязателен');
    } else if (type === 'order') {
        if (!Array.isArray(p.items) || p.items.length < 2) throw new Error('order: items ≥ 2');
    }
}

router.post(
    '/tests/:testId/questions',
    safe(async (req, res) => {
        const { type, text, payload, points } = req.body;
        if (!text) return res.status(400).json({ error: 'text обязателен' });
        const qType = QUESTION_TYPES.includes(type) ? type : 'single';
        try { validateQuestionPayload(qType, payload); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        const question = await prisma.question.create({
            data: {
                testId: req.params.testId, type: qType, text,
                payload: JSON.stringify(payload || {}), points: points ?? 1,
            },
        });
        res.json(question);
    })
);

router.patch(
    '/questions/:id',
    safe(async (req, res) => {
        const { type, text, payload, points } = req.body;
        const data = {};
        if (type !== undefined) {
            if (!QUESTION_TYPES.includes(type))
                return res.status(400).json({ error: 'Неверный type' });
            data.type = type;
        }
        if (text !== undefined) data.text = text;
        if (payload !== undefined) {
            const qType = data.type ||
                (await prisma.question.findUnique({ where: { id: req.params.id } })).type;
            try { validateQuestionPayload(qType, payload); }
            catch (e) { return res.status(400).json({ error: e.message }); }
            data.payload = JSON.stringify(payload);
        }
        if (points !== undefined) data.points = points;
        const question = await prisma.question.update({ where: { id: req.params.id }, data });
        res.json(question);
    })
);

router.delete(
    '/questions/:id',
    safe(async (req, res) => {
        await prisma.question.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

export default router;