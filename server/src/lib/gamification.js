import { prisma } from './prisma.js';
import { createNotification } from './notify.js';
import { getSettings, getLevelThresholdsCached, listAchievements } from './gamificationSettings.js';
import {
    CODE_ACHIEVEMENTS,
    ACHIEVEMENTS_MAP,
    DEFAULT_QUEST_TEMPLATES,
    LEARNING_QUEST_TYPES,
    STREAK_BONUS,
    MIN_COMMENT_LENGTH,
    levelFromXp,
    levelProgress,
} from './gamificationCatalog.js';

/* PATCH: хелпер — ошибки "запись исчезла во время работы" */
function isRecordGone(e) {
    return e?.code === 'P2025' || e?.code === 'P2003';
}

/* ─── Проверка включённости ─── */
export async function isGamificationEnabled() {
    const s = await getSettings();
    return s.enabled;
}

export async function ensureStats(userId) {
    return prisma.userStats.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });
}

/* ─── Загрузка активных достижений ─── */
async function loadActiveAchievements() {
    const [db, code] = await Promise.all([
        listAchievements().then((list) => list.filter((a) => a.active)),
        Promise.resolve(CODE_ACHIEVEMENTS),
    ]);
    return [...db, ...code];
}

/* ─── Контекст для достижений ─── */
async function computeContext(userId) {
    const [
        postsCount, commentsCount, commentsOnOthers,
        lessonsCompleted, perfectTests, certificatesCount,
        questsCompleted, stats, lastPost,
    ] = await Promise.all([
        prisma.post.count({ where: { authorId: userId } }),
        prisma.comment.count({ where: { authorId: userId, deletedAt: null } }),
        prisma.comment.count({
            where: {
                authorId: userId, deletedAt: null,
                post: { authorId: { not: userId } },
            },
        }),
        prisma.lessonProgress.count({ where: { userId, completed: true } }),
        prisma.testAttempt.count({ where: { userId, score: 100, passed: true } }),
        prisma.certificate.count({ where: { userId } }),
        prisma.dailyQuest.count({ where: { userId, completed: true } }),
        prisma.userStats.findUnique({ where: { userId } }),
        prisma.post.findFirst({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
    ]);

    return {
        postsCount,
        commentsCount,
        commentsOnOthers,
        lessonsCount: lessonsCompleted,
        perfectTests,
        certificatesCount,
        questsCompleted,
        streakCurrent: stats?.streakCurrent || 0,
        streakBest: stats?.streakBest || 0,
        level: stats?.level || 1,
        xp: stats?.xp || 0,
        lastPostHour: lastPost?.createdAt ? lastPost.createdAt.getHours() : null,
    };
}

async function checkNewAchievements(userId) {
    const [ctx, unlocked, achievements] = await Promise.all([
        computeContext(userId),
        prisma.userAchievement.findMany({
            where: { userId },
            select: { achievementId: true },
        }),
        loadActiveAchievements(),
    ]);
    const unlockedSet = new Set(unlocked.map((u) => u.achievementId));

    const newlyUnlocked = [];
    for (const a of achievements) {
        if (unlockedSet.has(a.id)) continue;
        let ok = false;
        if (a.counter != null && a.threshold != null) {
            ok = (ctx[a.counter] ?? 0) >= a.threshold;
        } else if (typeof a.check === 'function') {
            try { ok = !!a.check(ctx); } catch { ok = false; }
        }
        if (ok) newlyUnlocked.push(a.id);
    }

    if (newlyUnlocked.length === 0) return [];

    try {
        await prisma.userAchievement.createMany({
            data: newlyUnlocked.map((id) => ({ userId, achievementId: id })),
            skipDuplicates: true,
        });
    } catch (e) {
        if (isRecordGone(e)) return [];
        throw e;
    }

    const achMap = Object.fromEntries(achievements.map((a) => [a.id, a]));
    return newlyUnlocked.map((id) => achMap[id]).filter(Boolean);
}

/* ─── Начисление XP ─── */
export async function awardXp({ userId, amount, reason, meta = {}, silent = false }) {
    if (amount <= 0) return null;

    const s = await getSettings();
    if (!s.enabled) return null;

    /* PATCH: ensureStats может упасть, если юзер уже удалён */
    try {
        await ensureStats(userId);
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    const before = await prisma.userStats.findUnique({ where: { userId } });
    if (!before) return null;

    const xpBefore = before.xp || 0;
    const levelBefore = before.level || 1;

    const xpAfter = xpBefore + amount;
    const levelAfter = levelFromXp(xpAfter, s.levelThresholds);

    /* PATCH: транзакция может упасть P2025, если юзера удалили параллельно */
    try {
        await prisma.$transaction([
            prisma.userStats.update({
                where: { userId },
                data: { xp: xpAfter, level: levelAfter },
            }),
            prisma.xpLog.create({
                data: { userId, amount, reason, meta: JSON.stringify(meta) },
            }),
        ]);
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    const newAchievements = await checkNewAchievements(userId);

    const result = {
        userId, kind: 'award', amount, reason,
        xpBefore, xpAfter, levelBefore, levelAfter,
        levelUp: levelAfter > levelBefore,
        newAchievements,
        progress: levelProgress(xpAfter, s.levelThresholds),
    };

    if (!silent) await notifyGamificationEvents(userId, result);
    return result;
}

/* ─── Вычет XP ─── */
export async function deductXp({ userId, amount, reason, meta = {}, silent = false }) {
    if (amount <= 0) return null;

    const s = await getSettings();
    if (!s.enabled) return null;
    if (!s.deductionsEnabled) return null;

    try {
        await ensureStats(userId);
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    const before = await prisma.userStats.findUnique({ where: { userId } });
    if (!before) return null;

    const xpBefore = before.xp || 0;
    const levelBefore = before.level || 1;

    const xpAfter = Math.max(0, xpBefore - amount);
    const levelAfter = levelFromXp(xpAfter, s.levelThresholds);

    /* PATCH */
    try {
        await prisma.$transaction([
            prisma.userStats.update({
                where: { userId },
                data: { xp: xpAfter, level: levelAfter },
            }),
            prisma.xpLog.create({
                data: { userId, amount: -amount, reason, meta: JSON.stringify(meta) },
            }),
        ]);
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    const result = {
        userId, kind: 'deduct', amount: -amount, reason,
        xpBefore, xpAfter, levelBefore, levelAfter,
        levelDown: levelAfter < levelBefore,
        progress: levelProgress(xpAfter, s.levelThresholds),
    };

    if (!silent) await notifyGamificationEvents(userId, result);
    return result;
}

/* ─── Уведомления ─── */
function reasonLabel(reason) {
    return ({
        post_deleted: 'пост удалён',
        comment_deleted: 'комментарий удалён',
        test_failed: 'тест провален',
        report_upheld: 'жалоба подтверждена',
        admin_deduction: 'вычет от администрации',
        inactivity: 'отсутствие на сайте',
    })[reason] || reason;
}

async function notifyGamificationEvents(userId, result) {
    try {
        if (result.kind === 'award') {
            if (result.levelUp) {
                await createNotification(userId, 'level_up', {
                    level: result.levelAfter,
                    title: `Новый уровень: ${result.levelAfter}`,
                    message: `Вы достигли ${result.levelAfter} уровня!`,
                });
            }
            for (const a of result.newAchievements || []) {
                await createNotification(userId, 'achievement', {
                    achievementId: a.id,
                    title: a.title,
                    icon: a.icon,
                    rarity: a.rarity,
                    message: `Достижение: ${a.title}`,
                });
            }
        } else if (result.kind === 'deduct') {
            await createNotification(userId, 'xp_deduction', {
                amount: Math.abs(result.amount),
                reason: result.reason,
                reasonLabel: reasonLabel(result.reason),
                xpAfter: result.xpAfter,
                message: `-${Math.abs(result.amount)} XP: ${reasonLabel(result.reason)}`,
            });
        }
    } catch (e) {
        console.error('[gamification] notify failed:', e);
    }
}

/* ─── Даты ─── */
export function todayUTC() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function yesterdayUTC() {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* ─── Ежедневный вход ─── */
export async function recordDailyActivity(userId) {
    /* PATCH: полностью защищаем fire-and-forget задачу от удаления юзера */
    try {
        const s = await getSettings();
        if (!s.enabled) return null;

        await ensureStats(userId);

        const stats = await prisma.userStats.findUnique({ where: { userId } });
        if (!stats) return null;

        const today = todayUTC();
        const yesterday = yesterdayUTC();

        if (stats.lastActiveDate === today) {
            return { alreadyRecorded: true, streakCurrent: stats.streakCurrent };
        }

        let streakCurrent;
        if (stats.lastActiveDate === yesterday) {
            streakCurrent = stats.streakCurrent + 1;
        } else {
            streakCurrent = 1;
        }
        const streakBest = Math.max(stats.streakBest, streakCurrent);

        const baseXp = s.xp.daily_login || 0;
        const streakBonus = s.streakBonusEnabled
            ? Math.min(streakCurrent * STREAK_BONUS.per_day, STREAK_BONUS.cap)
            : 0;
        const totalXp = baseXp + streakBonus;

        await prisma.userStats.update({
            where: { userId },
            data: { lastActiveDate: today, streakCurrent, streakBest },
        });

        let awardResult = null;
        if (totalXp > 0) {
            awardResult = await awardXp({
                userId, amount: totalXp, reason: 'daily_login',
                meta: { streak: streakCurrent, base: baseXp, bonus: streakBonus },
                silent: true,
            });
        }

        return {
            alreadyRecorded: false,
            streakCurrent, streakBest, xpAwarded: totalXp, streakBonus,
            ...(awardResult || {}),
        };
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }
}

/* ─── Штраф за отсутствие ─── */
function dateFromKey(key) {
    return new Date(`${key}T00:00:00Z`);
}

export async function chargeInactivity(userId) {
    const s = await getSettings();
    if (!s.enabled || !s.deductionsEnabled) return null;
    if (!s.inactivityEnabled || s.inactivityAmount <= 0) return null;

    try {
        await ensureStats(userId);
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) return null;

    const today = todayUTC();
    if (stats.lastInactivityCharge === today) return null;
    if (!stats.lastActiveDate) return null;

    const lastActive = dateFromKey(stats.lastActiveDate);
    const todayDate = dateFromKey(today);
    const daysInactive = Math.floor((todayDate - lastActive) / 86400000);

    if (daysInactive < s.inactivityDays) return null;

    const days = Math.min(daysInactive, s.inactivityMaxDays);
    const amount = days * s.inactivityAmount;
    if (amount <= 0) return null;

    try {
        await prisma.userStats.update({
            where: { userId },
            data: { lastInactivityCharge: today },
        });
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    return deductXp({
        userId, amount, reason: 'inactivity',
        meta: { days, amountPerDay: s.inactivityAmount, inactiveSince: stats.lastActiveDate },
    });
}

/* ─── Получить статистику ─── */
export async function getUserGamification(userId) {
    await ensureStats(userId);
    const s = await getSettings();

    const [stats, unlocked, recentXp, achievements] = await Promise.all([
        prisma.userStats.findUnique({ where: { userId } }),
        prisma.userAchievement.findMany({
            where: { userId },
            orderBy: { unlockedAt: 'desc' },
        }),
        prisma.xpLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 30,
        }),
        loadActiveAchievements(),
    ]);

    const progress = levelProgress(stats.xp, s.levelThresholds);
    const unlockedMap = Object.fromEntries(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

    const sorted = [...achievements].sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
        stats: {
            xp: stats.xp,
            level: stats.level,
            streakCurrent: stats.streakCurrent,
            streakBest: stats.streakBest,
            lastActiveDate: stats.lastActiveDate,
        },
        progress,
        achievements: sorted.map((a) => ({
            ...a,
            unlocked: !!unlockedMap[a.id],
            unlockedAt: unlockedMap[a.id] || null,
        })),
        recentXp: recentXp.map((r) => ({
            ...r,
            meta: (() => {
                try { return JSON.parse(r.meta); } catch { return {}; }
            })(),
        })),
    };
}

/* ─── Лидерборд ─── */
export async function getLeaderboard({ period = 'all', limit = 50 } = {}) {
    if (period === 'week') {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const grouped = await prisma.xpLog.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: since } },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: limit,
        });
        const userIds = grouped.map((g) => g.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds }, isBanned: false },
            select: { id: true, fullName: true, username: true, avatar: true, direction: true },
        });
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
        return grouped
            .filter((g) => userMap[g.userId])
            .map((g, idx) => ({
                rank: idx + 1,
                user: userMap[g.userId],
                value: g._sum.amount || 0,
            }));
    }

    const stats = await prisma.userStats.findMany({
        orderBy: { xp: 'desc' },
        take: limit,
        include: {
            user: {
                select: {
                    id: true, fullName: true, username: true, avatar: true,
                    direction: true, isBanned: true,
                },
            },
        },
    });

    return stats
        .filter((s) => s.user && !s.user.isBanned)
        .map((s, idx) => ({
            rank: idx + 1,
            user: {
                id: s.user.id,
                fullName: s.user.fullName,
                username: s.user.username,
                avatar: s.user.avatar,
                direction: s.user.direction,
            },
            value: s.xp,
        }));
}

/* ─── Ежедневные квесты ─── */

async function ensureQuestTemplatesSeeded() {
    const count = await prisma.questTemplate.count();
    if (count > 0) return;
    await prisma.questTemplate.createMany({ data: DEFAULT_QUEST_TEMPLATES });
}

function pickWeighted(pool, n, excludeIds = new Set()) {
    const picked = [];
    const usedTypes = new Set();
    const local = pool.filter((t) => !excludeIds.has(t.id));

    while (picked.length < n && local.length > 0) {
        const total = local.reduce((sum, t) => sum + Math.max(1, t.weight || 1), 0);
        let r = Math.random() * total;
        let idx = 0;
        for (let i = 0; i < local.length; i++) {
            r -= Math.max(1, local[i].weight || 1);
            if (r <= 0) { idx = i; break; }
        }
        const candidate = local.splice(idx, 1)[0];

        if (!usedTypes.has(candidate.type) || local.length === 0 || picked.length >= n - 1) {
            picked.push(candidate);
            usedTypes.add(candidate.type);
        }
    }
    return picked;
}

async function hasActiveCourse(userId) {
    const cnt = await prisma.enrollment.count({
        where: { userId, completed: false },
    });
    return cnt > 0;
}

function ensureLearningQuest(picked, pool, n) {
    if (picked.some((p) => LEARNING_QUEST_TYPES.includes(p.type))) return picked;

    const learningTemplates = pool.filter((t) => LEARNING_QUEST_TYPES.includes(t.type));
    if (learningTemplates.length === 0) return picked;

    const total = learningTemplates.reduce((sum, t) => sum + Math.max(1, t.weight || 1), 0);
    let r = Math.random() * total;
    let chosen = learningTemplates[0];
    for (const t of learningTemplates) {
        r -= Math.max(1, t.weight || 1);
        if (r <= 0) { chosen = t; break; }
    }

    if (picked.length <= 1) return [chosen];
    return [...picked.slice(0, n - 1), chosen];
}

export async function ensureTodayQuests(userId) {
    const s = await getSettings();
    if (!s.enabled || !s.questsEnabled) return [];

    const today = todayUTC();
    const existing = await prisma.dailyQuest.findMany({
        where: { userId, date: today },
        orderBy: { createdAt: 'asc' },
    });
    if (existing.length > 0) return existing;

    await ensureQuestTemplatesSeeded();

    const templates = await prisma.questTemplate.findMany({
        where: { active: true },
    });
    if (templates.length === 0) return [];

    const activeCourse = await hasActiveCourse(userId);

    let picked = pickWeighted(templates, s.questsPerDay);
    if (activeCourse) {
        picked = ensureLearningQuest(picked, templates, s.questsPerDay);
    }

    if (picked.length === 0) return [];

    try {
        await prisma.dailyQuest.createMany({
            data: picked.map((t) => ({
                userId,
                date: today,
                type: t.type,
                target: t.target,
                xpReward: t.xpReward,
            })),
            skipDuplicates: true,
        });
    } catch (e) {
        if (isRecordGone(e)) return [];
        throw e;
    }

    return prisma.dailyQuest.findMany({
        where: { userId, date: today },
        orderBy: { createdAt: 'asc' },
    });
}

export async function getTodayQuests(userId) {
    return ensureTodayQuests(userId);
}

export async function bumpQuestProgress(userId, type, amount = 1) {
    const s = await getSettings();
    if (!s.enabled || !s.questsEnabled) return null;

    const today = todayUTC();
    const quest = await prisma.dailyQuest.findFirst({
        where: { userId, date: today, type, completed: false },
    });
    if (!quest) return null;

    const next = Math.min(quest.target, quest.current + amount);
    const reached = next >= quest.target;

    try {
        await prisma.dailyQuest.update({
            where: { id: quest.id },
            data: {
                current: next,
                completed: reached,
                completedAt: reached ? new Date() : null,
            },
        });
    } catch (e) {
        if (isRecordGone(e)) return null;
        throw e;
    }

    if (reached) {
        await awardXp({
            userId, amount: quest.xpReward, reason: 'quest_completed',
            meta: { type: quest.type, target: quest.target },
        });
        await checkNewAchievements(userId);
    }

    return { questId: quest.id, current: next, target: quest.target, completed: reached };
}

/* ─── Хуки ─── */
export async function onPostCreated(userId) {
    const s = await getSettings();
    const amount = s.xp.post_created || 0;
    if (amount > 0) await awardXp({ userId, amount, reason: 'post_created' });
    await bumpQuestProgress(userId, 'post_count', 1);
}

export async function onCommentCreated(userId, content) {
    if (!content || content.trim().length < MIN_COMMENT_LENGTH) return null;
    const s = await getSettings();
    const amount = s.xp.comment_created || 0;
    if (amount > 0) await awardXp({ userId, amount, reason: 'comment_created' });
    await bumpQuestProgress(userId, 'comment_count', 1);
}

export async function onReactionGiven(userId) {
    await bumpQuestProgress(userId, 'reaction_given', 1);
}

export async function onLessonCompleted(userId, lessonId) {
    const s = await getSettings();
    const amount = s.xp.lesson_completed || 0;
    if (amount > 0) await awardXp({ userId, amount, reason: 'lesson_completed', meta: { lessonId } });
    await bumpQuestProgress(userId, 'lesson_count', 1);
}

export async function onTestPassed(userId, testId, score) {
    const s = await getSettings();
    const amount = s.xp.test_passed || 0;
    if (amount > 0) await awardXp({ userId, amount, reason: 'test_passed', meta: { testId, score } });
    await bumpQuestProgress(userId, 'test_pass', 1);
}

export async function onTestFailed(userId, testId, score) {
    const s = await getSettings();
    if (!s.deductionsEnabled) return null;
    const amount = s.deductions.test_failed || 0;
    if (amount <= 0) return null;
    return deductXp({ userId, amount, reason: 'test_failed', meta: { testId, score } });
}

export async function onCertificateEarned(userId, certificateId) {
    const s = await getSettings();
    const amount = s.xp.certificate_earned || 0;
    if (amount > 0) await awardXp({ userId, amount, reason: 'certificate_earned', meta: { certificateId } });
    await bumpQuestProgress(userId, 'certificate_earned', 1);
}

export async function onPostDeleted(userId, postId) {
    const s = await getSettings();
    if (!s.deductionsEnabled) return null;
    const amount = s.deductions.post_deleted || 0;
    if (amount <= 0) return null;
    return deductXp({ userId, amount, reason: 'post_deleted', meta: { postId } });
}

export async function onCommentDeleted(userId, commentId) {
    const s = await getSettings();
    if (!s.deductionsEnabled) return null;
    const amount = s.deductions.comment_deleted || 0;
    if (amount <= 0) return null;
    return deductXp({ userId, amount, reason: 'comment_deleted', meta: { commentId } });
}

export async function onReportUpheld(userId, reportId) {
    const s = await getSettings();
    if (!s.deductionsEnabled) return null;
    const amount = s.deductions.report_upheld || 0;
    if (amount <= 0) return null;
    return deductXp({ userId, amount, reason: 'report_upheld', meta: { reportId } });
}

/* ─── Админские действия ─── */

export async function adminResetUser(userId) {
    await prisma.$transaction([
        prisma.userStats.upsert({
            where: { userId },
            update: {
                xp: 0, level: 1, streakCurrent: 0, streakBest: 0,
                lastActiveDate: null, lastInactivityCharge: null,
            },
            create: { userId },
        }),
        prisma.userAchievement.deleteMany({ where: { userId } }),
        prisma.xpLog.deleteMany({ where: { userId } }),
        prisma.dailyQuest.deleteMany({ where: { userId } }),
    ]);
    return { ok: true };
}

export async function adminResetAll() {
    await prisma.$transaction([
        prisma.userAchievement.deleteMany({}),
        prisma.xpLog.deleteMany({}),
        prisma.dailyQuest.deleteMany({}),
        prisma.userStats.updateMany({
            data: {
                xp: 0, level: 1, streakCurrent: 0, streakBest: 0,
                lastActiveDate: null, lastInactivityCharge: null,
            },
        }),
    ]);
    return { ok: true };
}

export async function adminGrantXp(userId, amount, reason = 'admin_grant') {
    if (amount > 0) return awardXp({ userId, amount, reason, silent: false });
    if (amount < 0) return deductXp({ userId, amount: -amount, reason: 'admin_deduction', silent: false });
    return null;
}

export async function getAdminOverview() {
    const [totalUsers, activeUsers, topStats, totalXpAgg, questsToday] = await Promise.all([
        prisma.userStats.count(),
        prisma.userStats.count({
            where: {
                lastActiveDate: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                        .toISOString().slice(0, 10),
                },
            },
        }),
        prisma.userStats.findMany({
            orderBy: { xp: 'desc' },
            take: 10,
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
        }),
        prisma.userStats.aggregate({ _sum: { xp: true }, _avg: { level: true } }),
        prisma.dailyQuest.count({ where: { date: todayUTC(), completed: true } }),
    ]);

    const achievementsCount = await prisma.userAchievement.groupBy({
        by: ['achievementId'],
        _count: true,
    });

    return {
        totalUsers,
        activeUsers,
        totalXp: totalXpAgg._sum.xp || 0,
        avgLevel: Math.round((totalXpAgg._avg.level || 0) * 10) / 10,
        questsCompletedToday: questsToday,
        topUsers: topStats,
        achievementsStats: achievementsCount.map((a) => ({
            achievementId: a.achievementId,
            count: a._count,
        })),
    };
}