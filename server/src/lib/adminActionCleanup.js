import { prisma } from './prisma.js';

/**
 * Автоочистка старых записей журнала действий админов.
 *
 * Логика:
 *   - удаляются AdminAction старше N дней
 *   - минимальный порог — 7 дней (защита от случайной очистки свежего)
 *   - по умолчанию выключено, пока админ не включит в настройках
 *   - dry-run ничего не удаляет, только считает
 *
 * Настройки в БД (таблица Setting):
 *   actions_cleanup_enabled = 'true' | 'false'
 *   actions_cleanup_days    = '180' (число дней, 7..3650)
 */

const MIN_DAYS = 7;
const MAX_DAYS = 3650;
const DEFAULT_DAYS = 180;
const SETTING_KEYS = ['actions_cleanup_enabled', 'actions_cleanup_days'];

/**
 * Текущее состояние автоочистки для UI и внутреннего использования.
 */
export async function getActionCleanupSettings() {
    const rows = await prisma.setting.findMany({
        where: { key: { in: SETTING_KEYS } },
    });
    const map = Object.fromEntries(rows.map((s) => [s.key, s.value]));

    const enabled = map.actions_cleanup_enabled === 'true';
    const days = Math.max(
        MIN_DAYS,
        Math.min(MAX_DAYS, Number(map.actions_cleanup_days) || DEFAULT_DAYS)
    );
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const [stale, total, oldest] = await Promise.all([
        prisma.adminAction.count({ where: { createdAt: { lt: cutoff } } }),
        prisma.adminAction.count(),
        prisma.adminAction.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
    ]);

    return {
        enabled,
        days,
        minDays: MIN_DAYS,
        maxDays: MAX_DAYS,
        stale,       // сколько удалится прямо сейчас
        total,       // всего записей
        oldest: oldest?.createdAt || null,
        cutoff: cutoff.toISOString(),
    };
}

/**
 * Удалить старые записи журнала.
 * trigger='cron'         — уважает enabled=false, тихо скипает.
 * trigger='manual-force' — выполняется всегда (админ нажал кнопку).
 */
export async function cleanupOldActions({ dryRun = false, trigger = 'manual' } = {}) {
    const settings = await getActionCleanupSettings();

    if (!settings.enabled && trigger !== 'manual-force') {
        return {
            deleted: 0,
            days: settings.days,
            enabled: false,
            dryRun,
            skipped: 'disabled',
        };
    }

    const where = { createdAt: { lt: new Date(settings.cutoff) } };

    if (dryRun) {
        const count = await prisma.adminAction.count({ where });
        return {
            deleted: 0,
            wouldDelete: count,
            days: settings.days,
            enabled: settings.enabled,
            dryRun: true,
            cutoff: settings.cutoff,
        };
    }

    const result = await prisma.adminAction.deleteMany({ where });
    console.log(
        `[action-cleanup] trigger=${trigger} days=${settings.days} deleted=${result.count}`
    );
    return {
        deleted: result.count,
        days: settings.days,
        enabled: settings.enabled,
        dryRun: false,
        cutoff: settings.cutoff,
    };
}