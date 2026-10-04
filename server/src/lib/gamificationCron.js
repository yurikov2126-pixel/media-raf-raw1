import cron from 'node-cron';
import { prisma } from './prisma.js';
import { getSettings } from './gamificationSettings.js';
import { chargeInactivity, todayUTC } from './gamification.js';

let scheduled = false;

/**
 * Раз в сутки обходит неактивных пользователей и списывает XP.
 * По умолчанию в 05:00 (после других cron-задач).
 */
export function scheduleInactivityCharge() {
    if (scheduled) {
        console.log('[gamification-cron] already scheduled');
        return;
    }

    const expr = process.env.GAMIFICATION_INACTIVITY_CRON || '0 5 * * *';

    cron.schedule(expr, async () => {
        try {
            const s = await getSettings();
            if (!s.enabled || !s.deductionsEnabled || !s.inactivityEnabled) {
                return;
            }

            const today = todayUTC();
            const cutoffDate = new Date(
                Date.now() - s.inactivityDays * 24 * 60 * 60 * 1000
            );
            const cutoffKey = `${cutoffDate.getUTCFullYear()}-${String(cutoffDate.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getUTCDate()).padStart(2, '0')}`;

            const users = await prisma.userStats.findMany({
                where: {
                    lastActiveDate: { lt: cutoffKey },
                    NOT: { lastInactivityCharge: today },
                },
                select: { userId: true },
            });

            let charged = 0;
            for (const u of users) {
                try {
                    const r = await chargeInactivity(u.userId);
                    if (r) charged++;
                } catch (e) {
                    console.error('[gamification-cron] charge failed for', u.userId, e.message);
                }
            }
            console.log(`[gamification-cron] charged ${charged} of ${users.length}`);
        } catch (e) {
            console.error('[gamification-cron] failed:', e);
        }
    });

    scheduled = true;
    console.log(`[gamification-cron] scheduled "${expr}"`);
}