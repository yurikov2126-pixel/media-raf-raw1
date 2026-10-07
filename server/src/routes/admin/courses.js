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
            certificateTitle, certificateDescription,
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
            'title', 'description', 'maxFiles', 'maxFileSizeMb',
            'dueAt', 'hoursToComplete', 'latePenaltyPerDay', 'latePenaltyMax',
        ];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === 'maxFiles')
                    data[k] = Math.max(1, Math.min(20, Number(req.body[k]) || 3));
                else if (k === 'maxFileSizeMb')
                    data[k] = Math.max(1, Math.min(500, Number(req.body[k]) || 50));
                else if (k === 'dueAt')
                    data[k] = req.body[k] ? new Date(req.body[k]) : null;
                else if (k === 'hoursToComplete')
                    data[k] = req.body[k] != null
                        ? Math.max(1, Math.min(2000, Number(req.body[k])))
                        : null;
                else if (k === 'latePenaltyPerDay')
                    data[k] = req.body[k] != null
                        ? Math.max(0, Math.min(5, Number(req.body[k])))
                        : 0;
                else if (k === 'latePenaltyMax')
                    data[k] = req.body[k] != null
                        ? Math.max(0, Math.min(5, Number(req.body[k])))
                        : 5;
                else data[k] = req.body[k];
            }
        }

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