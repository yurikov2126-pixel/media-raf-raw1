import cron from 'node-cron';
import { cleanupOldActions } from './adminActionCleanup.js';

let scheduled = false;

/**
 * Регистрирует cron автоочистки журнала AdminAction.
 * По умолчанию — раз в сутки в 06:00 (после push/notify/reset cleanup).
 * Идемпотентна: повторный вызов ничего не сделает.
 */
export function scheduleActionCleanup() {
    if (scheduled) {
        console.log('[action-cleanup] already scheduled, skip');
        return;
    }

    const expr = process.env.ACTION_CLEANUP_CRON || '0 6 * * *';

    cron.schedule(expr, async () => {
        try {
            const r = await cleanupOldActions({ trigger: 'cron' });
            if (r.skipped === 'disabled') {
                console.log('[action-cleanup] cron: disabled by setting');
            } else {
                console.log('[action-cleanup] cron done:', r);
            }
        } catch (e) {
            console.error('[action-cleanup] cron failed:', e);
        }
    });

    scheduled = true;
    console.log(`[action-cleanup] scheduled "${expr}"`);
}