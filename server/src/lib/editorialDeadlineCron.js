import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let scheduled = false;

// Reminders are scoped to an assigned project member and a specific dueAt value.
export async function runEditorialDeadlineReminders(now = new Date()) {
    const upcoming = new Date(now.getTime() + DAY_MS);
    const overdueSince = new Date(now.getTime() - 7 * DAY_MS);
    const tasks = await prisma.editorialTask.findMany({
        where: {
            assigneeId: { not: null },
            dueAt: { gte: overdueSince, lte: upcoming },
            status: { not: 'DONE' },
        },
        select: {
            id: true, title: true, dueAt: true, assigneeId: true,
            project: { select: { id: true, title: true, members: { select: { userId: true } } } },
        },
    });
    let due = 0;
    let overdue = 0;
    for (const task of tasks) {
        if (!task.project.members.some((member) => member.userId === task.assigneeId)) continue;
        const event = task.dueAt < now ? 'deadline_overdue' : 'deadline_soon';
        const dueKey = task.dueAt.toISOString();
        // Include the deadline in the marker: rescheduling enables a fresh reminder.
        const marker = `"reminderKey":"${task.id}:${event}:${dueKey}"`;
        const already = await prisma.notification.findFirst({
            where: { userId: task.assigneeId, type: 'editorial', payload: { contains: marker } },
            select: { id: true },
        });
        if (already) continue;
        const created = await createNotification(task.assigneeId, 'editorial', {
            event, reminderKey: `${task.id}:${event}:${dueKey}`,
            projectId: task.project.id, projectTitle: task.project.title,
            taskId: task.id, taskTitle: task.title, dueAt: dueKey,
        });
        if (!created) continue;
        if (event === 'deadline_soon') due++;
        else overdue++;
    }
    return { checked: tasks.length, due, overdue };
}

export function scheduleEditorialDeadlineReminders() {
    if (scheduled) return;
    const expression = process.env.EDITORIAL_DEADLINE_CRON || '0 * * * *';
    cron.schedule(expression, async () => {
        try {
            console.log('[editorial-deadline] done:', await runEditorialDeadlineReminders());
        } catch (error) {
            console.error('[editorial-deadline] failed:', error);
        }
    });
    scheduled = true;
    console.log(`[editorial-deadline] scheduled "${expression}"`);
}
