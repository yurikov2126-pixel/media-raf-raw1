import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const MINUTE_MS = 60000;
let scheduled = false;

// A short grace period tolerates cron drift; old events never generate late reminders.
export async function runPersonalEventReminders(now = new Date()) {
    const from = new Date(now.getTime() - 2 * MINUTE_MS);
    const to = new Date(now.getTime() + 1440 * MINUTE_MS + 2 * MINUTE_MS);
    const events = await prisma.personalCalendarEvent.findMany({
        where: {
            reminderMinutes: { in: [10, 30, 60, 1440] },
            startsAt: { gte: from, lte: to },
        },
        select: { id: true, ownerId: true, title: true, startsAt: true, reminderMinutes: true },
        take: 2000,
    });
    let sent = 0;
    for (const event of events) {
        const target = event.startsAt.getTime() - event.reminderMinutes * MINUTE_MS;
        if (target > now.getTime() || target < now.getTime() - 2 * MINUTE_MS) continue;
        const reminderKey = `personal-event:${event.id}:${event.startsAt.toISOString()}:${event.reminderMinutes}`;
        const marker = `"reminderKey":"${reminderKey}"`;
        const already = await prisma.notification.findFirst({
            where: { userId: event.ownerId, type: 'personal_calendar', payload: { contains: marker } },
            select: { id: true },
        });
        if (already) continue;
        const result = await createNotification(event.ownerId, 'personal_calendar', {
            event: 'event_reminder', reminderKey, eventId: event.id,
            eventTitle: event.title, startsAt: event.startsAt.toISOString(),
            reminderMinutes: event.reminderMinutes,
        });
        if (result) sent++;
    }
    return { checked: events.length, sent };
}

export function schedulePersonalEventReminders() {
    if (scheduled) return;
    cron.schedule('*/1 * * * *', async () => {
        try { await runPersonalEventReminders(); }
        catch (error) { console.error('[personal-calendar-reminders]', error); }
    });
    scheduled = true;
}
