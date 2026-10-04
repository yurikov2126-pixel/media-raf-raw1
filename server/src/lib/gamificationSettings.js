import { prisma } from './prisma.js';
import {
    XP_DEFAULTS,
    DEDUCTION_DEFAULTS,
    DEFAULT_LEVEL_THRESHOLDS,
    DEFAULT_ACHIEVEMENTS,
    LEVEL_MAX,
} from './gamificationCatalog.js';

const KEYS_XP = Object.keys(XP_DEFAULTS).map((k) => `gamification_xp_${k}`);
const KEYS_DEDUCT = Object.keys(DEDUCTION_DEFAULTS).map((k) => `gamification_deduct_${k}`);
const KEYS_BOOL = [
    'gamification_enabled',
    'gamification_leaderboard_enabled',
    'gamification_quests_enabled',
    'gamification_deductions_enabled',
    'gamification_streak_bonus_enabled',
    'gamification_deduct_inactivity_enabled',
];
const KEYS_INT = [
    'gamification_quests_per_day',
    'gamification_deduct_inactivity_days',
    'gamification_deduct_inactivity_amount',
    'gamification_deduct_inactivity_max_days',
];
const KEY_LEVELS = 'gamification_levels';
const ALL_KEYS = [...KEYS_XP, ...KEYS_DEDUCT, ...KEYS_BOOL, ...KEYS_INT, KEY_LEVELS];

function toBool(v, def) {
    if (v === undefined || v === null) return def;
    return v === 'true';
}
function toInt(v, def) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

/* ─── Кэш порогов уровней (обновляется при сохранении) ─── */
let levelThresholdsCache = null;

export function getLevelThresholdsCached() {
    return levelThresholdsCache || DEFAULT_LEVEL_THRESHOLDS;
}

/* ─── Чтение ─── */
export async function getSettings() {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ALL_KEYS } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const xp = {};
    for (const k of Object.keys(XP_DEFAULTS)) {
        xp[k] = toInt(map[`gamification_xp_${k}`], XP_DEFAULTS[k]);
    }

    const deductions = {};
    for (const k of Object.keys(DEDUCTION_DEFAULTS)) {
        deductions[k] = Math.abs(toInt(map[`gamification_deduct_${k}`], DEDUCTION_DEFAULTS[k]));
    }

    // Уровни — либо из БД, либо дефолт
    let levelThresholds = DEFAULT_LEVEL_THRESHOLDS;
    if (map[KEY_LEVELS]) {
        try {
            const parsed = JSON.parse(map[KEY_LEVELS]);
            if (Array.isArray(parsed) && parsed.length >= 2 && parsed.every((v) => Number.isFinite(v))) {
                // Проверяем неубывание и первый = 0
                let valid = parsed[0] === 0;
                for (let i = 1; i < parsed.length && valid; i++) {
                    if (parsed[i] < parsed[i - 1]) valid = false;
                }
                if (valid) levelThresholds = parsed;
            }
        } catch {}
    }

    // Обновляем кэш
    levelThresholdsCache = levelThresholds;

    return {
        enabled: toBool(map.gamification_enabled, true),
        leaderboardEnabled: toBool(map.gamification_leaderboard_enabled, true),
        questsEnabled: toBool(map.gamification_quests_enabled, true),
        deductionsEnabled: toBool(map.gamification_deductions_enabled, true),
        streakBonusEnabled: toBool(map.gamification_streak_bonus_enabled, true),
        questsPerDay: Math.max(1, Math.min(10, toInt(map.gamification_quests_per_day, 3))),

        inactivityEnabled: toBool(map.gamification_deduct_inactivity_enabled, false),
        inactivityDays: Math.max(1, Math.min(60, toInt(map.gamification_deduct_inactivity_days, 3))),
        inactivityAmount: Math.max(0, Math.min(1000, toInt(map.gamification_deduct_inactivity_amount, 5))),
        inactivityMaxDays: Math.max(1, Math.min(60, toInt(map.gamification_deduct_inactivity_max_days, 7))),

        xp,
        deductions,
        levelThresholds,
    };
}

/* ─── Запись ─── */
export async function updateSettings(patch) {
    const upserts = [];

    const setKey = (key, value) => {
        const v = String(value);
        upserts.push(
            prisma.setting.upsert({
                where: { key },
                update: { value: v },
                create: { key, value: v },
            })
        );
    };

    if (patch.enabled !== undefined) setKey('gamification_enabled', !!patch.enabled);
    if (patch.leaderboardEnabled !== undefined) setKey('gamification_leaderboard_enabled', !!patch.leaderboardEnabled);
    if (patch.questsEnabled !== undefined) setKey('gamification_quests_enabled', !!patch.questsEnabled);
    if (patch.deductionsEnabled !== undefined) setKey('gamification_deductions_enabled', !!patch.deductionsEnabled);
    if (patch.streakBonusEnabled !== undefined) setKey('gamification_streak_bonus_enabled', !!patch.streakBonusEnabled);
    if (patch.questsPerDay !== undefined) setKey('gamification_quests_per_day', Math.max(1, Math.min(10, Number(patch.questsPerDay) || 3)));

    if (patch.inactivityEnabled !== undefined) setKey('gamification_deduct_inactivity_enabled', !!patch.inactivityEnabled);
    if (patch.inactivityDays !== undefined) setKey('gamification_deduct_inactivity_days', Math.max(1, Math.min(60, Number(patch.inactivityDays) || 3)));
    if (patch.inactivityAmount !== undefined) setKey('gamification_deduct_inactivity_amount', Math.max(0, Math.min(1000, Number(patch.inactivityAmount) || 0)));
    if (patch.inactivityMaxDays !== undefined) setKey('gamification_deduct_inactivity_max_days', Math.max(1, Math.min(60, Number(patch.inactivityMaxDays) || 7)));

    if (patch.xp && typeof patch.xp === 'object') {
        for (const [k, v] of Object.entries(patch.xp)) {
            if (!KEYS_XP.includes(`gamification_xp_${k}`)) continue;
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0 || n > 10000) continue;
            setKey(`gamification_xp_${k}`, n);
        }
    }

    if (patch.deductions && typeof patch.deductions === 'object') {
        for (const [k, v] of Object.entries(patch.deductions)) {
            if (!KEYS_DEDUCT.includes(`gamification_deduct_${k}`)) continue;
            const n = Math.abs(Number(v));
            if (!Number.isFinite(n) || n < 0 || n > 10000) continue;
            setKey(`gamification_deduct_${k}`, n);
        }
    }

    if (Array.isArray(patch.levelThresholds)) {
        const arr = patch.levelThresholds.map((v) => Math.max(0, Number(v) || 0));
        // Валидация: минимум 2 уровня, первый = 0, неубывание
        if (arr.length >= 2 && arr[0] === 0) {
            let valid = true;
            for (let i = 1; i < arr.length; i++) {
                if (arr[i] < arr[i - 1]) { valid = false; break; }
            }
            if (valid) {
                setKey(KEY_LEVELS, JSON.stringify(arr));
                levelThresholdsCache = arr;
            }
        }
    }

    if (upserts.length > 0) {
        await prisma.$transaction(upserts);
    }

    return getSettings();
}

/* ─── Достижения ─── */

/** Seed DB из дефолтов при первом обращении. */
export async function ensureAchievementsSeeded() {
    const count = await prisma.achievement.count();
    if (count > 0) return;
    await prisma.achievement.createMany({ data: DEFAULT_ACHIEVEMENTS });
}

export async function listAchievements() {
    await ensureAchievementsSeeded();
    return prisma.achievement.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
}

export async function createAchievement(data) {
    const id = String(data.id || '').trim();
    if (!id) throw new Error('ID обязателен');
    if (!/^[a-z0-9_]{3,40}$/.test(id)) {
        throw new Error('ID: 3-40 символов, только a-z, 0-9, _');
    }
    const exists = await prisma.achievement.findUnique({ where: { id } });
    if (exists) throw new Error('Достижение с таким ID уже существует');

    return prisma.achievement.create({
        data: {
            id,
            title: String(data.title || '').slice(0, 100),
            description: String(data.description || '').slice(0, 300),
            icon: String(data.icon || '🏆').slice(0, 8),
            rarity: ['common', 'rare', 'epic', 'legendary'].includes(data.rarity) ? data.rarity : 'common',
            counter: data.counter || null,
            threshold: data.threshold != null ? Math.max(1, Math.min(10000, Number(data.threshold) || 1)) : null,
            active: data.active !== false,
            order: Number(data.order) || 0,
        },
    });
}

export async function updateAchievement(id, data) {
    const update = {};
    if (data.title !== undefined) update.title = String(data.title).slice(0, 100);
    if (data.description !== undefined) update.description = String(data.description).slice(0, 300);
    if (data.icon !== undefined) update.icon = String(data.icon).slice(0, 8);
    if (data.rarity !== undefined && ['common', 'rare', 'epic', 'legendary'].includes(data.rarity)) {
        update.rarity = data.rarity;
    }
    if (data.counter !== undefined) update.counter = data.counter || null;
    if (data.threshold !== undefined) {
        update.threshold = data.threshold != null
            ? Math.max(1, Math.min(10000, Number(data.threshold) || 1))
            : null;
    }
    if (data.active !== undefined) update.active = !!data.active;
    if (data.order !== undefined) update.order = Number(data.order) || 0;

    return prisma.achievement.update({ where: { id }, data: update });
}

export async function deleteAchievement(id) {
    await prisma.achievement.delete({ where: { id } });
    return { ok: true };
}

export async function resetAchievementsToDefaults() {
    await prisma.achievement.deleteMany({});
    await prisma.achievement.createMany({ data: DEFAULT_ACHIEVEMENTS });
    return listAchievements();
}