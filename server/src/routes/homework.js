import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';

const router = Router();
router.use(auth);

/* ─────────── Студент: сдать ДЗ ─────────── */
router.post('/:homeworkId/submit', async (req, res) => {
    try {
        const { text, link, files } = req.body || {};
        const hw = await prisma.homework.findUnique({
            where: { id: req.params.homeworkId },
            include: {
                lesson: {
                    include: { course: { select: { id: true, title: true } } },
                },
            },
        });
        if (!hw) return res.status(404).json({ error: 'ДЗ не найдено' });

        if (!text?.trim() && !link?.trim() && (!Array.isArray(files) || files.length === 0)) {
            return res.status(400).json({ error: 'Нужно сдать хотя бы что-то: текст, ссылку или файл' });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: hw.lesson.courseId } },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        const filesJson = JSON.stringify(Array.isArray(files) ? files : []);

        const submission = await prisma.homeworkSubmission.upsert({
            where: { homeworkId_userId: { homeworkId: hw.id, userId: req.user.id } },
            update: {
                text: text || null,
                link: link || null,
                files: filesJson,
                status: 'PENDING',
                reviewedBy: null,
                reviewedAt: null,
                feedback: null,
                grade: null,
            },
            create: {
                homeworkId: hw.id,
                userId: req.user.id,
                text: text || null,
                link: link || null,
                files: filesJson,
            },
        });

        res.json(submission);
    } catch (e) {
        console.error('[homework] submit error:', e);
        res.status(500).json({ error: e.message });
    }
});

/* ─────────── Студент: мои ДЗ ─────────── */
router.get('/my', async (req, res) => {
    const list = await prisma.homeworkSubmission.findMany({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            homework: {
                include: {
                    lesson: {
                        include: { course: { select: { id: true, slug: true, title: true } } },
                    },
                },
            },
        },
    });
    res.json(list);
});

/* ─────────── Руководитель: список на проверку ─────────── */
router.get('/review', async (req, res) => {
    if (req.user.role !== 'MENTOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    const list = await prisma.homeworkSubmission.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
            homework: {
                include: {
                    lesson: {
                        include: { course: { select: { id: true, title: true } } },
                    },
                },
            },
            user: { select: { id: true, fullName: true, username: true, avatar: true } },
        },
    });
    res.json(list);
});

/* ─────────── Руководитель: проверить ─────────── */
router.post('/submissions/:id/review', async (req, res) => {
    if (req.user.role !== 'MENTOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    const { status, feedback, grade } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'status должен быть APPROVED или REJECTED' });
    }

    const submission = await prisma.homeworkSubmission.findUnique({
        where: { id: req.params.id },
        include: { homework: true },
    });
    if (!submission) return res.status(404).json({ error: 'Заявка не найдена' });

    const updated = await prisma.homeworkSubmission.update({
        where: { id: submission.id },
        data: {
            status,
            feedback: feedback || null,
            grade: grade != null ? Number(grade) : null,
            reviewedBy: req.user.id,
            reviewedAt: new Date(),
        },
    });

    await createNotification(submission.userId, 'system', {
        title: status === 'APPROVED' ? 'ДЗ принято' : 'ДЗ требует доработки',
        message:
            status === 'APPROVED'
                ? `«${submission.homework.title}» принято${grade ? ` (оценка ${grade})` : ''}`
                : `«${submission.homework.title}»: ${feedback || 'нужно доработать'}`,
        homeworkId: submission.homework.id,
        status,
    }).catch(() => {});

    res.json(updated);
});

export default router;