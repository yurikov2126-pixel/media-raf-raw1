import cron from 'node-cron';
import { cleanupOldNotifications } from './notifyCleanup.js';

let scheduled = false;

/**
 * Регистрирует cron-задачу автоочистки старых уведомлений.
 * По умолчанию — каждый день в 04:30 (после push cleanup в 04:00).
 *
 * Идемпотентна: повторный вызов ничего не сделает.
 */
export function scheduleNotifyCleanup() {
    if (scheduled) {
        console.log('[notify-cleanup] already scheduled, skip');
        return;
    }

    const expr = process.env.NOTIFY_CLEANUP_CRON || '30 4 * * *';

    cron.schedule(expr, async () => {
        try {
            const r = await cleanupOldNotifications({ trigger: 'cron' });
            if (r.skipped === 'disabled') {
                console.log('[notify-cleanup] cron: disabled by setting');
            } else {
                console.log('[notify-cleanup] cron done:', r);
            }
        } catch (e) {
            console.error('[notify-cleanup] cron failed:', e);
        }
    });

    scheduled = true;
    console.log(`[notify-cleanup] scheduled "${expr}"`);
}