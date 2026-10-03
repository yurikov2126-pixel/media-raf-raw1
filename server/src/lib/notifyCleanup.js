import { prisma } from './prisma.js';

/**
 * Автоочистка старых ПРОЧИТАННЫХ уведомлений.
 *
 * Логика:
 *   - удаляются только уведомления с readAt IS NOT NULL
 *   - старше N дней (createdAt < cutoff)
 *   - непрочитанные НИКОГДА не трогаются — пользователь не должен
 *     потерять важное, если давно не заходил
 *
 * Настройки в БД (таблица Setting):
 *   notifications_cleanup_enabled = 'true' | 'false'
 *   notifications_cleanup_days    = '90' (число дней)
 *
 * Возвращает { deleted, days, enabled, dryRun }.
 */
export async function cleanupOldNotifications({ dryRun = false, trigger = 'manual' } = {}) {
    const settings = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    'notifications_cleanup_enabled',
                    'notifications_cleanup_days',
                ],
            },
        },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    // По умолчанию — выключено, пока админ не включит в настройках
    const enabled = map.notifications_cleanup_enabled === 'true';
    const days = Math.max(1, Math.min(730, Number(map.notifications_cleanup_days) || 90));

    if (!enabled && trigger !== 'manual-force') {
        return { deleted: 0, days, enabled, dryRun, skipped: 'disabled' };
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = {
        readAt: { not: null },
        createdAt: { lt: cutoff },
    };

    if (dryRun) {
        const count = await prisma.notification.count({ where });
        return {
            deleted: 0,
            wouldDelete: count,
            days,
            enabled,
            dryRun: true,
            cutoff: cutoff.toISOString(),
        };
    }

    const result = await prisma.notification.deleteMany({ where });

    console.log(`[notify-cleanup] trigger=${trigger} days=${days} deleted=${result.count}`);
    return {
        deleted: result.count,
        days,
        enabled,
        dryRun: false,
        cutoff: cutoff.toISOString(),
    };
}

/**
 * Возвращает текущее состояние автоочистки для UI.
 */
export async function getNotifyCleanupSettings() {
    const settings = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    'notifications_cleanup_enabled',
                    'notifications_cleanup_days',
                ],
            },
        },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const enabled = map.notifications_cleanup_enabled === 'true';
    const days = Math.max(1, Math.min(730, Number(map.notifications_cleanup_days) || 90));

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [staleRead, totalRead, totalUnread, total] = await Promise.all([
        prisma.notification.count({ where: { readAt: { not: null }, createdAt: { lt: cutoff } } }),
        prisma.notification.count({ where: { readAt: { not: null } } }),
        prisma.notification.count({ where: { readAt: null } }),
        prisma.notification.count(),
    ]);

    return {
        enabled,
        days,
        staleRead,       // сколько удалится прямо сейчас
        totalRead,       // всего прочитанных
        totalUnread,     // всего непрочитанных (не удаляются)
        total,           // всего уведомлений
        cutoff: cutoff.toISOString(),
    };
}