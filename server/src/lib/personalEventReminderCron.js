import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const MINUTE_MS = 60000;
let scheduled = false;
let running = false;
const GRACE_MS = 15 * MINUTE_MS;

// Recover reminders missed during a brief restart or worker delay (up to 15 minutes).
export async function runPersonalEventReminders(now = new Date()) {
    const from = new Date(now.getTime() - GRACE_MS);
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
        if (target > now.getTime() || target < now.getTime() - GRACE_MS) continue;
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
    scheduled = true;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const result = await runPersonalEventReminders();
            if (result.sent) console.log('[personal-calendar-reminders] sent:', result.sent);
        } catch (error) { console.error('[personal-calendar-reminders]', error); }
        finally { running = false; }
    };
    cron.schedule('* * * * *', tick);
    // Check immediately after server start instead of waiting for the next minute.
    void tick();
}
