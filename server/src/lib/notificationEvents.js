import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

/**
 * Уведомляет всех записанных на курс о новом уроке.
 * Отправляется только если курс опубликован.
 */
export async function notifyNewLesson({ courseId, lessonId, lessonTitle, lessonOrder }) {
    try {
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, title: true, slug: true, published: true },
        });
        if (!course || !course.published) return { sent: 0, reason: 'not published' };

        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            select: { userId: true },
        });
        if (enrollments.length === 0) return { sent: 0 };

        let sent = 0;
        for (const e of enrollments) {
            await createNotification(e.userId, 'lesson_new', {
                courseId: course.id,
                courseTitle: course.title,
                courseSlug: course.slug,
                lessonId,
                lessonTitle,
                lessonOrder,
            });
            sent++;
        }
        return { sent };
    } catch (err) {
        console.error('[notifyNewLesson] failed:', err);
        return { sent: 0, error: err.message };
    }
}

/**
 * Уведомляет всех записанных на курс о назначенной практической дате.
 * Если scheduledAt не задан — ничего не отправляем.
 * isUpdate — true, если это изменение уже существующей даты
 * (по умолчанию шлём только первое назначение).
 */
export async function notifyPracticalScheduled({ practicalId, isUpdate = false }) {
    try {
        const practical = await prisma.practicalWork.findUnique({
            where: { id: practicalId },
            include: {
                course: { select: { id: true, title: true, slug: true, published: true } },
                lesson: { select: { id: true, order: true, title: true } },
            },
        });
        if (!practical || !practical.course.published) return { sent: 0 };
        if (!practical.scheduledAt) return { sent: 0 };

        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: practical.courseId },
            select: { userId: true },
        });
        if (enrollments.length === 0) return { sent: 0 };

        let sent = 0;
        for (const e of enrollments) {
            await createNotification(e.userId, 'practical_scheduled', {
                practicalId: practical.id,
                courseTitle: practical.course.title,
                courseSlug: practical.course.slug,
                lessonOrder: practical.lesson.order,
                lessonTitle: practical.lesson.title,
                topic: practical.topic,
                scheduledAt: practical.scheduledAt,
                isUpdate,
            });
            sent++;
        }
        return { sent };
    } catch (err) {
        console.error('[notifyPracticalScheduled] failed:', err);
        return { sent: 0, error: err.message };
    }
}