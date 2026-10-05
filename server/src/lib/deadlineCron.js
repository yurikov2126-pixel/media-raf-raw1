import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const HOURS_BEFORE = 24;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
let scheduled = false;

/**
 * Дедлайн ДЗ для конкретного пользователя.
 * Приоритет: hoursToComplete → dueAt.
 */
export async function computeHomeworkDeadline(homework, userId) {
    if (homework.hoursToComplete != null) {
        const lp = await prisma.lessonProgress.findUnique({
            where: { userId_lessonId: { userId, lessonId: homework.lessonId } },
            select: { completed: true, completedAt: true },
        });
        if (!lp?.completed || !lp.completedAt) {
            return { deadline: null, source: null };
        }
        const deadline = new Date(
            lp.completedAt.getTime() + homework.hoursToComplete * HOUR_MS
        );
        return { deadline, source: 'relative' };
    }
    if (homework.dueAt) {
        return { deadline: homework.dueAt, source: 'fixed' };
    }
    return { deadline: null, source: null };
}

/**
 * Считает штраф за просрочку.
 * Возвращает { lateDays, penalty } — оба числа (0, если просрочки нет).
 */
export function computeLatePenalty({ submittedAt, deadline, perDay, max }) {
    if (!deadline || !perDay || perDay <= 0) return { lateDays: 0, penalty: 0 };
    if (submittedAt <= deadline) return { lateDays: 0, penalty: 0 };

    const ms = submittedAt.getTime() - deadline.getTime();
    const lateDays = Math.ceil(ms / DAY_MS);
    const penaltyRaw = perDay * lateDays;
    const cap = max != null ? max : 5;
    const penalty = Math.min(penaltyRaw, cap);
    return { lateDays, penalty };
}

/* ───────── Напоминания о практиках ───────── */
async function sendPracticalReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + HOURS_BEFORE * HOUR_MS);

    const practicals = await prisma.practicalWork.findMany({
        where: { scheduledAt: { gte: now, lte: in24h } },
        include: {
            course: { select: { id: true, title: true, slug: true } },
            lesson: { select: { order: true } },
        },
    });

    let sent = 0;
    for (const p of practicals) {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: p.courseId },
            select: { userId: true },
        });
        const approved = await prisma.practicalSubmission.findMany({
            where: { practicalId: p.id, status: 'APPROVED' },
            select: { userId: true },
        });
        const approvedSet = new Set(approved.map((s) => s.userId));

        for (const e of enrollments) {
            if (approvedSet.has(e.userId)) continue;
            const already = await prisma.notification.findFirst({
                where: {
                    userId: e.userId,
                    type: 'practical_due',
                    payload: { contains: `"practicalId":"${p.id}"` },
                },
                select: { id: true },
            });
            if (already) continue;

            await createNotification(e.userId, 'practical_due', {
                practicalId: p.id,
                courseTitle: p.course.title,
                courseSlug: p.course.slug,
                lessonOrder: p.lesson.order,
                topic: p.topic,
                scheduledAt: p.scheduledAt,
            });
            sent++;
        }
    }
    return sent;
}

/* ───────── Напоминания о ДЗ ───────── */
async function sendHomeworkReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + HOURS_BEFORE * HOUR_MS);
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

    const homeworks = await prisma.homework.findMany({
        where: {
            OR: [
                { hoursToComplete: { not: null } },
                { dueAt: { not: null } },
            ],
        },
        include: {
            lesson: {
                include: { course: { select: { id: true, title: true, slug: true } } },
            },
        },
    });

    let sentDue = 0;
    let sentOverdue = 0;

    for (const h of homeworks) {
        const courseId = h.lesson.courseId;
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            select: { userId: true },
        });
        const submitted = await prisma.homeworkSubmission.findMany({
            where: { homeworkId: h.id, status: { in: ['PENDING', 'APPROVED'] } },
            select: { userId: true },
        });
        const submittedSet = new Set(submitted.map((s) => s.userId));

        for (const e of enrollments) {
            if (submittedSet.has(e.userId)) continue;
            const { deadline } = await computeHomeworkDeadline(h, e.userId);
            if (!deadline) continue;

            const isSoon = deadline >= now && deadline <= in24h;
            const isOverdue = deadline < now && deadline >= sevenDaysAgo;

            if (isSoon) {
                const already = await prisma.notification.findFirst({
                    where: {
                        userId: e.userId,
                        type: 'homework_due',
                        payload: { contains: `"homeworkId":"${h.id}"` },
                    },
                    select: { id: true },
                });
                if (already) continue;
                await createNotification(e.userId, 'homework_due', {
                    homeworkId: h.id, title: h.title,
                    courseTitle: h.lesson.course.title,
                    courseSlug: h.lesson.course.slug,
                    lessonOrder: h.lesson.order, dueAt: deadline,
                });
                sentDue++;
            } else if (isOverdue) {
                const already = await prisma.notification.findFirst({
                    where: {
                        userId: e.userId,
                        type: 'homework_overdue',
                        payload: { contains: `"homeworkId":"${h.id}"` },
                    },
                    select: { id: true },
                });
                if (already) continue;
                await createNotification(e.userId, 'homework_overdue', {
                    homeworkId: h.id, title: h.title,
                    courseTitle: h.lesson.course.title,
                    courseSlug: h.lesson.course.slug,
                    lessonOrder: h.lesson.order, dueAt: deadline,
                });
                sentOverdue++;
            }
        }
    }
    return { sentDue, sentOverdue };
}

export async function runDeadlineReminders() {
    const [practicals, homeworks] = await Promise.all([
        sendPracticalReminders(),
        sendHomeworkReminders(),
    ]);
    return { practicals, homeworks };
}

export function scheduleDeadlineReminders() {
    if (scheduled) {
        console.log('[deadline-cron] already scheduled, skip');
        return;
    }
    const expr = process.env.DEADLINE_CRON || '0 9 * * *';
    cron.schedule(expr, async () => {
        try {
            const r = await runDeadlineReminders();
            console.log('[deadline-cron] done:', r);
        } catch (e) {
            console.error('[deadline-cron] failed:', e);
        }
    });
    scheduled = true;
    console.log(`[deadline-cron] scheduled "${expr}"`);
}