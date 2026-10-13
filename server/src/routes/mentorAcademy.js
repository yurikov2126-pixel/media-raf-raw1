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

        // Use an explicit list of course IDs so access cannot leak other courses.
        const assigned = req.user.role === 'ADMIN' ? null : await prisma.practicalWork.findMany({
            where: { supervisorId: req.user.id }, select: { courseId: true },
        });
        const courseIds = assigned ? [...new Set(assigned.map((p) => p.courseId))] : null;
        const where = courseIds === null ? {} : { courseId: { in: courseIds } };

        const [enrollments, homework, practicals, courses, attempts] = await Promise.all([
            prisma.enrollment.findMany({
                where,
                select: {
                    id: true, userId: true, courseId: true, progress: true, completed: true, createdAt: true,
                    user: { select: { id: true, username: true, fullName: true, avatar: true } },
                    course: { select: { id: true, title: true, slug: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            canHomework ? prisma.homeworkSubmission.findMany({ where: { homework: { lesson: where } }, select: { status: true, createdAt: true, reviewedAt: true, homework: { select: { lesson: { select: { courseId: true } } } } } }) : [],
            canPractical ? prisma.practicalSubmission.findMany({ where: { practical: where }, select: { status: true, createdAt: true, reviewedAt: true, practical: { select: { courseId: true } } } }) : [],
            prisma.course.findMany({ where: courseIds === null ? {} : { id: { in: courseIds } }, select: { id: true, slug: true, title: true } }),
            prisma.testAttempt.findMany({
                where: { test: { lesson: where } },
                orderBy: { createdAt: 'desc' }, take: 1500,
                select: { score: true, passed: true, createdAt: true, userId: true,
                    test: { select: { id: true, title: true, lesson: { select: { courseId: true, order: true } } } } },
            }),
        ]);
        const summary = courses.map((course) => {
            const members = enrollments.filter((e) => e.courseId === course.id);
            const courseAttempts = attempts.filter((a) => a.test.lesson.courseId === course.id);
            const submitted = [
                ...homework.filter((x) => x.homework.lesson.courseId === course.id),
                ...practicals.filter((x) => x.practical.courseId === course.id),
            ];
            const reviewed = submitted.filter((x) => x.reviewedAt);
            const avgReviewHours = reviewed.length ? Math.round(10 * reviewed.reduce((n, x) =>
                n + Math.max(0, new Date(x.reviewedAt) - new Date(x.createdAt)) / 3600000, 0) / reviewed.length) / 10 : null;
            const tests = new Map();
            for (const a of courseAttempts) {
                const id = a.test.id;
                if (!tests.has(id)) tests.set(id, { id, title: a.test.title, lessonOrder: a.test.lesson.order, count: 0, failed: 0, totalScore: 0 });
                const t = tests.get(id); t.count++; t.failed += a.passed ? 0 : 1; t.totalScore += a.score;
            }
            const testStats = [...tests.values()].map(({ totalScore, ...t }) => ({
                ...t, failedPercent: Math.round(t.failed / t.count * 100),
                averageScore: Math.round(totalScore / t.count),
            })).sort((a,b) => b.failedPercent - a.failedPercent);
            return {
                ...course, students: members.length,
                completed: members.filter((e) => e.completed).length,
                averageProgress: members.length ? Math.round(members.reduce((sum, e) => sum + e.progress, 0) / members.length) : 0,
                pendingHomework: homework.filter((s) => s.homework.lesson.courseId === course.id && s.status === 'PENDING').length,
                pendingPracticals: practicals.filter((s) => s.practical.courseId === course.id && s.status === 'PENDING').length,
                averageTestScore: courseAttempts.length ? Math.round(courseAttempts.reduce((sum,a)=>sum+a.score,0)/courseAttempts.length) : null,
                failedTestPercent: courseAttempts.length ? Math.round(courseAttempts.filter(a=>!a.passed).length/courseAttempts.length*100) : null,
                averageReviewHours: avgReviewHours,
                testStats: testStats.slice(0, 8),
                scoreTimeline: courseAttempts.slice(0, 20).reverse().map(a => ({
                    score: a.score, passed: a.passed, date: a.createdAt,
                })),
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

/* Подробная учебная карточка: доступ только к назначенному наставнику курсу. */
router.get('/students/:userId/courses/:courseId', async (req, res) => {
    try {
        const [canHomework, canPractical] = await Promise.all([
            hasPermission(req.user, 'learning.homework.review'),
            hasPermission(req.user, 'learning.practicals.review'),
        ]);
        if (!canHomework && !canPractical) return res.status(403).json({ error: 'Нет прав' });
        const { userId, courseId } = req.params;
        if (req.user.role !== 'ADMIN') {
            const assigned = await prisma.practicalWork.findFirst({
                where: { courseId, supervisorId: req.user.id },
                select: { id: true },
            });
            if (!assigned) return res.status(403).json({ error: 'Курс не назначен наставнику' });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
                course: { select: { id: true, title: true, slug: true,
                    lessons: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true } },
                } },
            },
        });
        if (!enrollment) return res.status(404).json({ error: 'Запись на курс не найдена' });

        const [progress, attempts, homework, practicals] = await Promise.all([
            prisma.lessonProgress.findMany({
                where: { userId, lesson: { courseId } },
                select: { lessonId: true, completed: true, completedAt: true },
            }),
            prisma.testAttempt.findMany({
                where: { userId, test: { lesson: { courseId } } },
                orderBy: { createdAt: 'desc' },
                select: { id: true, score: true, passed: true, createdAt: true,
                    test: { select: { title: true, lesson: { select: { id: true, order: true } } } } },
            }),
            canHomework ? prisma.homeworkSubmission.findMany({
                where: { userId, homework: { lesson: { courseId } } },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, status: true, grade: true, finalGrade: true, feedback: true,
                    createdAt: true, updatedAt: true, reviewedAt: true,
                    homework: { select: { title: true, lesson: { select: { id: true, order: true } } } },
                    reviewer: { select: { fullName: true } },
                },
            }) : [],
            canPractical ? prisma.practicalSubmission.findMany({
                where: { userId, practical: { courseId, ...(req.user.role === 'ADMIN' ? {} : { supervisorId: req.user.id }) } },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, status: true, grade: true, feedback: true, createdAt: true,
                    updatedAt: true, reviewedAt: true,
                    practical: { select: { topic: true, lesson: { select: { id: true, order: true } } } },
                    reviewer: { select: { fullName: true } },
                },
            }) : [],
        ]);
        const completed = new Set(progress.filter((entry) => entry.completed).map((entry) => entry.lessonId));
        res.json({
            student: enrollment.user,
            course: { id: enrollment.course.id, title: enrollment.course.title, slug: enrollment.course.slug },
            progress: enrollment.progress, completed: enrollment.completed,
            lessons: enrollment.course.lessons.map((lesson) => ({
                ...lesson, completed: completed.has(lesson.id),
                completedAt: progress.find((entry) => entry.lessonId === lesson.id)?.completedAt || null,
            })),
            attempts: attempts.map((a) => ({ id: a.id, title: a.test.title, lessonOrder: a.test.lesson.order,
                score: a.score, passed: a.passed, createdAt: a.createdAt })),
            homework: homework.map((a) => ({ id: a.id, title: a.homework.title, lessonOrder: a.homework.lesson.order,
                status: a.status, grade: a.finalGrade ?? a.grade, feedback: a.feedback,
                updatedAt: a.updatedAt, reviewer: a.reviewer?.fullName || null })),
            practicals: practicals.map((a) => ({ id: a.id, title: a.practical.topic, lessonOrder: a.practical.lesson.order,
                status: a.status, grade: a.grade, feedback: a.feedback,
                updatedAt: a.updatedAt, reviewer: a.reviewer?.fullName || null })),
        });
    } catch (error) {
        console.error('[mentor academy student]', error);
        res.status(500).json({ error: 'Не удалось загрузить учебную карточку' });
    }
});

export default router;
