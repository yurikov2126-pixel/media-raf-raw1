import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { hasPermission } from '../lib/roles.js';
import { createNotification } from '../lib/notify.js';

const router = Router();
router.use(auth);
const allowed = new Set(['homework', 'practical']);
const parse = (s) => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

async function context(kind, workId, studentId) {
    if (kind === 'homework') {
        const work = await prisma.homework.findUnique({ where: { id: workId },
            include: { lesson: { include: { course: { select: { id: true, slug: true } } } } } });
        if (!work) return null;
        const submission = await prisma.homeworkSubmission.findUnique({
            where: { homeworkId_userId: { homeworkId: workId, userId: studentId } },
        });
        return { work, submission, courseId: work.lesson.course.id, slug: work.lesson.course.slug, lessonOrder: work.lesson.order };
    }
    const work = await prisma.practicalWork.findUnique({ where: { id: workId },
        include: { course: { select: { id: true, slug: true } }, lesson: { select: { order: true } } },
    });
    if (!work) return null;
    const submission = await prisma.practicalSubmission.findUnique({
        where: { practicalId_userId: { practicalId: workId, userId: studentId } },
    });
    return { work, submission, courseId: work.courseId, slug: work.course.slug, lessonOrder: work.lesson?.order };
}
async function access(req, kind, workId, studentId, mustReview = false) {
    if (!allowed.has(kind) || !workId || !studentId) return { status: 400 };
    const data = await context(kind, workId, studentId);
    if (!data) return { status: 404 };
    const isStudent = req.user.id === studentId;
    if (isStudent && !mustReview) {
        const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: studentId, courseId: data.courseId } } });
        if (enrolled) return { data, isStudent: true };
    }
    const permission = kind === 'homework' ? 'learning.homework.review' : 'learning.practicals.review';
    if (!(await hasPermission(req.user, permission))) return { status: 403 };
    if (req.user.role !== 'ADMIN') {
        const assignment = kind === 'practical'
            ? data.work.supervisorId === req.user.id
            : !!(await prisma.practicalWork.findFirst({ where: { courseId: data.courseId, supervisorId: req.user.id }, select: { id: true } }));
        if (!assignment) return { status: 403 };
    }
    if (!data.submission) return { status: 404 };
    return { data, isStudent: false };
}

router.get('/:kind/:workId/:studentId/messages', async (req, res) => {
    try {
        const { kind, workId, studentId } = req.params;
        const a = await access(req, kind, workId, studentId);
        if (!a.data) return res.status(a.status).json({ error: 'Нет доступа к обсуждению' });
        const messages = await prisma.learningDiscussionMessage.findMany({
            where: { kind, workId, studentId }, orderBy: { createdAt: 'asc' }, take: 200,
        });
        const people = await prisma.user.findMany({
            where: { id: { in: [...new Set(messages.map((m) => m.authorId))] } },
            select: { id: true, fullName: true, avatar: true },
        });
        const names = new Map(people.map((p) => [p.id, p]));
        res.json(messages.map((m) => ({ ...m, files: parse(m.files), author: names.get(m.authorId) || null })));
    } catch (err) {
        console.error('[learning discussion list]', err);
        res.status(500).json({ error: 'Не удалось загрузить обсуждение' });
    }
});

router.post('/:kind/:workId/:studentId/messages', async (req, res) => {
    try {
        const { kind, workId, studentId } = req.params;
        const a = await access(req, kind, workId, studentId);
        if (!a.data) return res.status(a.status).json({ error: 'Нет доступа к обсуждению' });
        const text = String(req.body?.text || '').trim();
        const files = req.body?.files ?? [];
        if (!text && (!Array.isArray(files) || !files.length)) return res.status(400).json({ error: 'Введите сообщение или приложите файл' });
        if (text.length > 4000 || !Array.isArray(files) || files.length > 5 ||
            files.some((f) => !f || typeof f.url !== 'string' || !f.url.startsWith('/uploads/') || typeof f.name !== 'string')) {
            return res.status(400).json({ error: 'Недопустимые вложения или слишком длинный текст' });
        }
        const version = kind === 'homework' && a.data.submission
            ? await prisma.homeworkSubmissionVersion.findFirst({ where: { submissionId: a.data.submission.id }, orderBy: { version: 'desc' }, select: { version: true } })
            : null;
        const message = await prisma.learningDiscussionMessage.create({
            data: { kind, workId, studentId, authorId: req.user.id, text,
                files: JSON.stringify(files.map((f) => ({ name: f.name.slice(0, 200), url: f.url }))), version: version?.version ?? null },
        });
        const supervisor = a.isStudent && kind === 'homework'
            ? await prisma.practicalWork.findFirst({ where: { courseId: a.data.courseId, supervisorId: { not: null } }, select: { supervisorId: true } })
            : null;
        const recipient = a.isStudent ? (kind === 'practical' ? a.data.work.supervisorId : supervisor?.supervisorId) : studentId;
        if (recipient && recipient !== req.user.id) {
            await createNotification(recipient, 'system', {
                title: 'Новое сообщение по учебной работе',
                message: text.slice(0, 160) || 'Прикреплены файлы',
                courseSlug: a.data.slug, lessonOrder: a.data.lessonOrder,
                ...(kind === 'homework' ? { homeworkId: workId } : { practicalId: workId }),
            }).catch(() => {});
        }
        res.status(201).json({ ...message, files: parse(message.files), author: {
            id: req.user.id, fullName: req.user.fullName, avatar: req.user.avatar,
        } });
    } catch (err) {
        console.error('[learning discussion send]', err);
        res.status(500).json({ error: 'Не удалось отправить сообщение' });
    }
});

router.get('/:kind/:workId/:studentId/grades', async (req, res) => {
    try {
        const { kind, workId, studentId } = req.params;
        const a = await access(req, kind, workId, studentId);
        if (!a.data) return res.status(a.status).json({ error: 'Нет доступа' });
        if (!a.data.submission) return res.json([]);
        const grades = await prisma.learningRubricGrade.findMany({
            where: { kind, submissionId: a.data.submission.id },
            orderBy: { createdAt: 'desc' }, take: 20,
        });
        res.json(grades.map((g) => ({ ...g, criteria: parse(g.criteria) })));
    } catch (err) {
        console.error('[learning rubric grades]', err);
        res.status(500).json({ error: 'Не удалось загрузить оценивание' });
    }
});

router.put('/:kind/:workId/rubric', async (req, res) => {
    try {
        const { kind, workId } = req.params;
        if (!allowed.has(kind)) return res.status(400).json({ error: 'Неверный тип задания' });
        const work = kind === 'homework'
            ? await prisma.homework.findUnique({ where: { id: workId }, select: { lesson: { select: { courseId: true } } } })
            : await prisma.practicalWork.findUnique({ where: { id: workId }, select: { courseId: true, supervisorId: true } });
        if (!work) return res.status(404).json({ error: 'Задание не найдено' });
        const permission = kind === 'homework' ? 'learning.homework.review' : 'learning.practicals.review';
        if (!(await hasPermission(req.user, permission))) return res.status(403).json({ error: 'Нет прав' });
        if (req.user.role !== 'ADMIN') {
            const assigned = await prisma.practicalWork.findFirst({
                where: { courseId: kind === 'homework' ? work.lesson.courseId : work.courseId, supervisorId: req.user.id },
                select: { id: true },
            });
            if (!assigned) return res.status(403).json({ error: 'Курс не назначен' });
        }
        const items = req.body?.criteria;
        if (!Array.isArray(items) || items.length > 10 || items.some((x) =>
            typeof x.title !== 'string' || !x.title.trim() || x.title.length > 120 ||
            !Number.isInteger(x.max) || x.max < 1 || x.max > 5)) {
            return res.status(400).json({ error: 'Некорректные критерии оценивания' });
        }
        const rubric = JSON.stringify(items.map((x) => ({ title: x.title.trim(), max: x.max })));
        const result = kind === 'homework'
            ? await prisma.homework.update({ where: { id: workId }, data: { rubric }, select: { rubric: true } })
            : await prisma.practicalWork.update({ where: { id: workId }, data: { rubric }, select: { rubric: true } });
        res.json({ criteria: parse(result.rubric) });
    } catch (err) {
        console.error('[learning rubric]', err);
        res.status(500).json({ error: 'Не удалось сохранить критерии' });
    }
});

export default router;
