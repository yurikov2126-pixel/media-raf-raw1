import { calculateRubricGrade } from '../lib/rubricGrades.js';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { hasPermission } from '../lib/roles.js';
import { createNotification } from '../lib/notify.js';

const router = Router();
router.use(auth);

/* ─────────── Студент: сдать практику ─────────── */
router.post('/:practicalId/submit', async (req, res) => {
    try {
        const { note } = req.body || {};
        const practical = await prisma.practicalWork.findUnique({
            where: { id: req.params.practicalId },
            include: {
                course: { select: { id: true, slug: true, title: true } },
                lesson: { select: { id: true, title: true } },
                supervisor: { select: { id: true, fullName: true } },
            },
        });
        if (!practical) return res.status(404).json({ error: 'Практика не найдена' });

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: practical.courseId } },
        });
        if (!enrollment) return res.status(403).json({ error: 'Не записаны на курс' });

        const submission = await prisma.practicalSubmission.upsert({
            where: {
                practicalId_userId: {
                    practicalId: practical.id,
                    userId: req.user.id,
                },
            },
            update: {
                status: 'PENDING',
                note: note || null,
                reviewedBy: null,
                reviewedAt: null,
                feedback: null,
                grade: null,
            },
            create: {
                practicalId: practical.id,
                userId: req.user.id,
                note: note || null,
            },
        });

        if (practical.supervisorId) {
            await createNotification(practical.supervisorId, 'system', {
                title: 'Практика сдана на проверку',
                message: `${req.user.fullName} отметил практику «${practical.topic}»`,
                practicalId: practical.id,
                studentName: req.user.fullName,
                courseTitle: practical.course.title,
            }).catch(() => {});
        }

        res.json(submission);
    } catch (e) {
        console.error('[practicals] submit error:', e);
        res.status(500).json({ error: e.message });
    }
});

/* ─────────── Студент: получить свои практики ─────────── */
router.get('/my', async (req, res) => {
    const submissions = await prisma.practicalSubmission.findMany({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            practical: {
                include: {
                    course: { select: { id: true, slug: true, title: true } },
                    lesson: { select: { id: true, title: true } },
                    supervisor: { select: { id: true, fullName: true, username: true } },
                },
            },
        },
    });
    res.json(submissions);
});

/* ─────────── Руководитель: список практик ───────────
   Query-параметры:
     status   — PENDING | APPROVED | REJECTED (фильтр по статусу сдач)
     courseId — только по конкретному курсу
   Возвращает массив практик с массивом submissions внутри. */
router.get('/review', async (req, res) => {
    if (!(await hasPermission(req.user, 'learning.practicals.review'))) {
        return res.status(403).json({ error: 'Нет прав' });
    }

    const { courseId, status } = req.query;

    const where = req.user.role === 'ADMIN' ? {} : { supervisorId: req.user.id };
    if (courseId) where.courseId = courseId;

    const practicals = await prisma.practicalWork.findMany({
        where,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        include: {
            course: { select: { id: true, slug: true, title: true } },
            lesson: { select: { id: true, title: true, order: true } },
            supervisor: { select: { id: true, fullName: true } },
            submissions: {
                where: status ? { status } : undefined,
                include: {
                    user: { select: { id: true, fullName: true, username: true, avatar: true } },
                    reviewer: { select: { id: true, fullName: true, username: true } },
                },
                orderBy: { updatedAt: 'desc' },
            },
        },
    });
    res.json(practicals);
});

/* ─────────── Руководитель: одобрить / отклонить ─────────── */
router.post('/submissions/:id/review', async (req, res) => {
    if (!(await hasPermission(req.user, 'learning.practicals.review'))) {
        return res.status(403).json({ error: 'Нет прав' });
    }

    const { status, feedback, grade, criteriaScores } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'status должен быть APPROVED или REJECTED' });
    }

    const submission = await prisma.practicalSubmission.findUnique({
        where: { id: req.params.id },
        include: {
            practical: {
                include: {
                    course: { select: { id: true, title: true, slug: true } },
                    lesson: { select: { order: true } },
                },
            },
            user: { select: { id: true, fullName: true } },
        },
    });
    if (!submission) return res.status(404).json({ error: 'Заявка не найдена' });

    if (req.user.role !== 'ADMIN' && submission.practical.supervisorId !== req.user.id) {
        return res.status(403).json({ error: 'Вы не руководитель этой практики' });
    }

    let rubricAssessment;
    try { rubricAssessment = calculateRubricGrade(submission.practical.rubric, criteriaScores, status); }
    catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    const finalGrade = rubricAssessment ? rubricAssessment.grade : grade != null && grade !== '' ? Number(grade) : null;
    const updated = await prisma.practicalSubmission.update({
        where: { id: submission.id },
        data: {
            status,
            feedback: feedback || null,
            grade: finalGrade,
            reviewedBy: req.user.id,
            reviewedAt: new Date(),
        },
    });

    if (rubricAssessment) await prisma.learningRubricGrade.create({ data: { kind: 'practical', submissionId: submission.id,
        criteria: JSON.stringify(rubricAssessment.lines), reviewedBy: req.user.id } });

    await createNotification(submission.userId, 'system', {
        title: status === 'APPROVED' ? 'Практика принята' : 'Практика отклонена',
        message:
            status === 'APPROVED'
                ? `Практика «${submission.practical.topic}» принята${finalGrade != null ? ` (оценка ${finalGrade})` : ''}`
                : `Практика «${submission.practical.topic}» отклонена${feedback ? `: ${feedback}` : ''}`,
        practicalId: submission.practical.id,
        courseSlug: submission.practical.course.slug,
        lessonOrder: submission.practical.lesson?.order,
        status,
    }).catch(() => {});

    res.json(updated);
});

/* ─────────── Админ / руководитель: принудительно разблокировать ─────────── */
router.post('/unlock/:lessonId', async (req, res) => {
    if (!(await hasPermission(req.user, 'learning.practicals.unlock'))) {
        return res.status(403).json({ error: 'Нет прав' });
    }
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const lesson = await prisma.lesson.findUnique({
        where: { id: req.params.lessonId },
        include: { course: true },
    });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    const practical = await prisma.practicalWork.findUnique({
        where: { lessonId: lesson.id },
    });
    if (practical) {
        await prisma.practicalSubmission.upsert({
            where: { practicalId_userId: { practicalId: practical.id, userId } },
            update: {
                status: 'APPROVED',
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                feedback: 'Разблокировано администратором',
            },
            create: {
                practicalId: practical.id,
                userId,
                status: 'APPROVED',
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                feedback: 'Разблокировано администратором',
            },
        });
    }

    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        update: { completed: true },
        create: { userId, lessonId: lesson.id, completed: true },
    });

    await createNotification(userId, 'system', {
        title: 'Урок разблокирован',
        message: `Администратор открыл вам урок «${lesson.title}»`,
        lessonId: lesson.id,
    }).catch(() => {});

    res.json({ ok: true });
});

export default router;