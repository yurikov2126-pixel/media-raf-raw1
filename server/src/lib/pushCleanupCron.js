import cron from 'node-cron';
import { cleanupInactivePushSubscriptions } from './pushCleanup.js';

let scheduled = false;

/**
 * Регистрирует cron-задачу автоочистки push-подписок.
 * По умолчанию — каждый день в 04:00 (после бэкапа в 03:00).
 *
 * Идемпотентна: повторный вызов ничего не сделает.
 */
export function schedulePushCleanup() {
    if (scheduled) {
        console.log('[push-cleanup] already scheduled, skip');
        return;
    }

    const expr = process.env.PUSH_CLEANUP_CRON || '0 4 * * *';

    cron.schedule(expr, async () => {
        try {
            const r = await cleanupInactivePushSubscriptions({ trigger: 'cron' });
            if (r.skipped === 'disabled') {
                console.log('[push-cleanup] cron: disabled by setting');
            } else {
                console.log('[push-cleanup] cron done:', r);
            }
        } catch (e) {
            console.error('[push-cleanup] cron failed:', e);
        }
    });

    scheduled = true;
    console.log(`[push-cleanup] scheduled "${expr}"`);
}