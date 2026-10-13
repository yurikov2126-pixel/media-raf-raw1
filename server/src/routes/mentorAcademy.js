import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/roles.js';

const router = Router();
router.use(auth);

/* Educational analytics: never exposes students outside a mentor's assigned courses. */
router.get('/overview', async (req, res) => {
    try {
        const canHomework = await hasPermission(req.user, 'learning.homework.review');
        const canPractical = await hasPermission(req.user, 'learning.practicals.review');
        if (!canHomework && !canPractical) return res.status(403).json({ error: 'Нет прав на просмотр обучения' });

        const courseScope = req.user.role === 'ADMIN' ? {} : {
            practicalWorks: { some: { supervisorId: req.user.id } },
        };
        // Use an explicit list of course IDs so access cannot leak other courses.
        const assigned = req.user.role === 'ADMIN' ? null : await prisma.practicalWork.findMany({
            where: { supervisorId: req.user.id }, select: { courseId: true },
        });
        const courseIds = assigned ? [...new Set(assigned.map((p) => p.courseId))] : null;
        const where = courseIds === null ? {} : { courseId: { in: courseIds } };

        const [enrollments, homework, practicals, courses] = await Promise.all([
            prisma.enrollment.findMany({
                where,
                select: {
                    id: true, userId: true, courseId: true, progress: true, completed: true, createdAt: true,
                    user: { select: { id: true, username: true, fullName: true, avatar: true } },
                    course: { select: { id: true, title: true, slug: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            canHomework ? prisma.homeworkSubmission.findMany({ where: { homework: { lesson: { course: where } } }, select: { status: true, homework: { select: { lesson: { select: { courseId: true } } } } } }) : [],
            canPractical ? prisma.practicalSubmission.findMany({ where: { practical: where }, select: { status: true, practical: { select: { courseId: true } } } }) : [],
            prisma.course.findMany({ where: courseIds === null ? {} : { id: { in: courseIds } }, select: { id: true, slug: true, title: true } }),
        ]);
        const summary = courses.map((course) => {
            const members = enrollments.filter((e) => e.courseId === course.id);
            return {
                ...course, students: members.length,
                completed: members.filter((e) => e.completed).length,
                averageProgress: members.length ? Math.round(members.reduce((sum, e) => sum + e.progress, 0) / members.length) : 0,
                pendingHomework: homework.filter((s) => s.homework.lesson.courseId === course.id && s.status === 'PENDING').length,
                pendingPracticals: practicals.filter((s) => s.practical.courseId === course.id && s.status === 'PENDING').length,
            };
        });
        res.json({
            courses: summary,
            students: enrollments.map((e) => ({
                id: e.id, student: e.user, courseId: e.courseId, courseTitle: e.course.title,
                courseSlug: e.course.slug, progress: e.progress, completed: e.completed, enrolledAt: e.createdAt,
            })),
            totals: {
                students: new Set(enrollments.map((e) => e.userId)).size,
                active: enrollments.filter((e) => !e.completed).length,
                completed: enrollments.filter((e) => e.completed).length,
                pending: homework.filter((s) => s.status === 'PENDING').length + practicals.filter((s) => s.status === 'PENDING').length,
            },
        });
    } catch (err) {
        console.error('[mentor academy overview]', err);
        res.status(500).json({ error: 'Не удалось получить аналитику Академии' });
    }
});

export default router;
