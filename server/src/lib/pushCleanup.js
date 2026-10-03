import { prisma } from './prisma.js';

/**
 * Автоочистка неактивных push-подписок.
 *
 * «Неактивная» = подписка, у которой lastUsed старше N дней.
 * lastUsed обновляется при каждой успешной отправке push — если он
 * не обновлялся N дней, значит устройство не получало уведомлений
 * (пользователь не заходил, удалил приложение, браузер почистил данные).
 *
 * Настройки в БД (таблица Setting):
 *   push_subscriptions_cleanup_enabled = 'true' | 'false'
 *   push_subscriptions_cleanup_days    = '90' (число дней)
 *
 * Возвращает { deleted, days, enabled, dryRun }.
 */
export async function cleanupInactivePushSubscriptions({ dryRun = false, trigger = 'manual' } = {}) {
    const settings = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    'push_subscriptions_cleanup_enabled',
                    'push_subscriptions_cleanup_days',
                ],
            },
        },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const enabled = map.push_subscriptions_cleanup_enabled === 'true';
    const days = Math.max(1, Math.min(730, Number(map.push_subscriptions_cleanup_days) || 90));

    // При dryRun — считаем, но не удаляем. При trigger=cron — если выключено, ничего не делаем.
    if (!enabled && trigger !== 'manual-force') {
        return { deleted: 0, days, enabled, dryRun, skipped: 'disabled' };
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // lastUsed — обязательное поле (DateTime @default(now())), поэтому null быть не может.
    // Фильтруем только по нему.
    const where = {
        lastUsed: { lt: cutoff },
    };

    if (dryRun) {
        const count = await prisma.pushSubscription.count({ where });
        return {
            deleted: 0,
            wouldDelete: count,
            days,
            enabled,
            dryRun: true,
            cutoff: cutoff.toISOString(),
        };
    }

    const result = await prisma.pushSubscription.deleteMany({ where });

    console.log(`[push-cleanup] trigger=${trigger} days=${days} deleted=${result.count}`);
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
export async function getPushCleanupSettings() {
    const settings = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    'push_subscriptions_cleanup_enabled',
                    'push_subscriptions_cleanup_days',
                ],
            },
        },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const enabled = map.push_subscriptions_cleanup_enabled === 'true';
    const days = Math.max(1, Math.min(730, Number(map.push_subscriptions_cleanup_days) || 90));

    // Сколько подписок попадает под критерий прямо сейчас
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const staleCount = await prisma.pushSubscription.count({
        where: { lastUsed: { lt: cutoff } },
    });

    const total = await prisma.pushSubscription.count();

    return {
        enabled,
        days,
        staleCount,
        total,
        cutoff: cutoff.toISOString(),
    };
}