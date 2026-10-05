import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let scheduled = false;

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/**
 * Для курсов с dripMode='schedule':
 *   урок с индексом i (0-based) открывается в день
 *   enrollment.createdAt + i * dripInterval.
 *
 * Раз в день проверяем, у кого из студентов урок стал доступен
 * именно СЕГОДНЯ (в интервале [начало_сегодня, начало_завтра)),
 * и отправляем уведомление 'lesson_unlocked'.
 */
async function sendDripUnlockNotifications() {
    const startToday = startOfDay(new Date());
    const startTomorrow = new Date(startToday.getTime() + DAY_MS);

    const courses = await prisma.course.findMany({
        where: {
            dripMode: 'schedule',
            dripInterval: { not: null },
            published: true,
        },
        include: {
            lessons: {
                orderBy: { order: 'asc' },
                select: { id: true, order: true, title: true },
            },
        },
    });

    let sent = 0;
    let checked = 0;

    for (const course of courses) {
        if (course.lessons.length === 0) continue;
        const interval = course.dripInterval || 7;

        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: course.id },
            select: { userId: true, createdAt: true },
        });

        for (const e of enrollments) {
            checked++;
            const start = startOfDay(new Date(e.createdAt));

            // Урок с индексом i (0-based): открывается в start + i*interval дней.
            for (let i = 0; i < course.lessons.length; i++) {
                if (i === 0) continue; // урок 1 доступен сразу — про него не уведомляем

                const unlockDay = new Date(start.getTime() + i * interval * DAY_MS);

                const isToday =
                    unlockDay >= startToday && unlockDay < startTomorrow;
                if (!isToday) continue;

                const lesson = course.lessons[i];

                // Проверяем, не отправляли ли уже
                const already = await prisma.notification.findFirst({
                    where: {
                        userId: e.userId,
                        type: 'lesson_unlocked',
                        payload: { contains: `"lessonId":"${lesson.id}"` },
                    },
                    select: { id: true },
                });
                if (already) continue;

                await createNotification(e.userId, 'lesson_unlocked', {
                    courseTitle: course.title,
                    courseSlug: course.slug,
                    lessonId: lesson.id,
                    lessonTitle: lesson.title,
                    lessonOrder: lesson.order,
                });
                sent++;
            }
        }
    }

    return { sent, checked };
}

export async function runDripUnlockNotifications() {
    return sendDripUnlockNotifications();
}

export function scheduleDripUnlockNotifications() {
    if (scheduled) {
        console.log('[drip-cron] already scheduled, skip');
        return;
    }

    // Каждый день в 08:00
    const expr = process.env.DRIP_CRON || '0 8 * * *';

    cron.schedule(expr, async () => {
        try {
            const r = await runDripUnlockNotifications();
            console.log('[drip-cron] done:', r);
        } catch (e) {
            console.error('[drip-cron] failed:', e);
        }
    });

    scheduled = true;
    console.log(`[drip-cron] scheduled "${expr}"`);
}