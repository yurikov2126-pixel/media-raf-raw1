import cron from 'node-cron';
import { cleanupOldRequests } from './passwordReset.js';

let scheduled = false;

export function schedulePasswordResetCleanup() {
    if (scheduled) {
        console.log('[password-reset] already scheduled, skip');
        return;
    }

    // Каждый день в 04:45 — после push cleanup (04:00) и notify cleanup (04:30)
    const expr = process.env.PASSWORD_RESET_CLEANUP_CRON || '45 4 * * *';

    cron.schedule(expr, async () => {
        try {
            const r = await cleanupOldRequests(30);
            console.log('[password-reset] cron done:', r);
        } catch (e) {
            console.error('[password-reset] cron failed:', e);
        }
    });

    scheduled = true;
    console.log(`[password-reset] scheduled "${expr}"`);
}