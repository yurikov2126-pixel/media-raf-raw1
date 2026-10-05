import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { auth, requireRole } from '../middleware/auth.js';
import { notifyBroadcast } from '../lib/notify.js';
import {
    listBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    checkPgTools,
} from '../lib/backup.js';
import { cleanupAfterUserDelete, getLiveChatStats } from '../lib/chatCleanup.js';
import {
    scanDatabase,
    cleanupDatabase,
    getDatabaseInfo,
    runVacuumAnalyze,
} from '../lib/dbMaintenance.js';
import { getAnalytics } from '../lib/analytics.js';
import { getCourseAnalytics, buildSummary } from '../lib/courseAnalytics.js';
import {
    sendPushToAll,
    sendPushToUser,
    sendPushToUsers,
} from '../lib/push.js';
import {
    recalcAllProgress,
    issueMissingCertificates,
    recalcUserCourse,
    enrollUsersToCourse,
    unenrollUsersFromCourse,
    resetProgressForCourse,
    importCurriculum,
    validateCurriculum,
    updateLessonVideos,
    exportCourseAsJSON,
    exportAllCoursesAsJSON,
    exportSnapshot,
    listActions,
} from '../lib/bulkActions.js';
import { getServerInfo, cleanupPm2Logs, cleanupOldBackups } from '../lib/serverInfo.js';
import {
    listReports,
    updateReport,
    deleteReportedContent,
    banReportedUser,
    REPORT_META,
} from '../lib/moderation.js';
import {
    getPushCleanupSettings,
    cleanupInactivePushSubscriptions,
} from '../lib/pushCleanup.js';
import {
    getNotifyCleanupSettings,
    cleanupOldNotifications,
} from '../lib/notifyCleanup.js';
import { MODULES, getModulesState, setModuleEnabled } from '../lib/modules.js';
import { ONBOARDING_VERSION, ONBOARDING_STEPS } from '../lib/onboarding.js';
import {
    adminResetUser,
    adminResetAll,
    adminGrantXp,
    getAdminOverview,
} from '../lib/gamification.js';
import {
    getSettings as getGamifSettings,
    updateSettings as updateGamifSettings,
    listAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    resetAchievementsToDefaults,
} from '../lib/gamificationSettings.js';
import {
    QUEST_TEMPLATES,
    XP_DEFAULTS,
    DEDUCTION_DEFAULTS,
    RARITIES,
    COUNTER_OPTIONS,
    DEFAULT_LEVEL_THRESHOLDS,
} from '../lib/gamificationCatalog.js';
import {
    listResetRequests,
    getStats as getPasswordResetStats,
    generateCodeForRequest,
    rejectRequest,
} from '../lib/passwordReset.js';
import { notifyNewLesson, notifyPracticalScheduled } from '../lib/notificationEvents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const BACKUPS_DIR = path.join(SERVER_ROOT, 'backups');

const router = Router();
router.use(auth, requireRole('ADMIN'));

const safe = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (e) {
        console.error('[admin] error:', e);
        if (e.code === 'P2003')
            return res.status(409).json({ error: 'Связано с другими данными' });
        if (e.code === 'P2025')
            return res.status(404).json({ error: 'Запись не найдена' });
        res.status(500).json({ error: e.message || 'Внутренняя ошибка' });
    }
};

/* ═══════════ ДАШБОРД ═══════════ */
router.get(
    '/stats',
    safe(async (_req, res) => {
        const [users, courses, enrollments, certificates, posts] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.enrollment.count(),
            prisma.certificate.count(),
            prisma.post.count(),
        ]);
        const chatStats = await getLiveChatStats();
        res.json({
            users,
            courses,
            enrollments,
            certificates,
            posts,
            chats: chatStats.liveChats,
            messages: chatStats.liveMessages,
            dbTotalChats: chatStats.dbTotalChats,
            orphanChats: chatStats.orphanChats,
        });
    })
);

/* ═══════════ СЕРВЕР ═══════════ */
router.get(
    '/server/info',
    safe(async (_req, res) => {
        res.json(await getServerInfo());
    })
);

router.post(
    '/server/cleanup',
    safe(async (req, res) => {
        const { logs, backups, backupsDays } = req.body || {};
        const result = {};
        if (logs) result.logs = cleanupPm2Logs();
        if (backups) result.backups = cleanupOldBackups(Number(backupsDays) || 30);
        res.json(result);
    })
);

/* ═══════════ ОБСЛУЖИВАНИЕ БД ═══════════ */
router.get(
    '/maintenance/scan',
    safe(async (_req, res) => {
        res.json(await scanDatabase());
    })
);

router.post(
    '/maintenance/cleanup',
    safe(async (_req, res) => {
        res.json(await cleanupDatabase());
    })
);

router.get(
    '/maintenance/dbinfo',
    safe(async (_req, res) => {
        const info = await getDatabaseInfo();
        const tools = checkPgTools();
        res.json({ ...info, tools });
    })
);

router.post(
    '/maintenance/vacuum',
    safe(async (_req, res) => {
        await runVacuumAnalyze();
        res.json({ ok: true, message: 'VACUUM ANALYZE выполнен' });
    })
);

/* ═══════════ АНАЛИТИКА ═══════════ */
router.get(
    '/analytics',
    safe(async (req, res) => {
        const period = Math.max(7, Math.min(365, Number(req.query.period) || 30));
        res.json(await getAnalytics(period));
    })
);

/* ─── Воронка по курсам ─── */
router.get(
    '/analytics/courses',
    safe(async (req, res) => {
        const periodRaw = req.query.period;
        let periodDays = null;
        if (periodRaw && periodRaw !== 'all') {
            periodDays = Math.max(7, Math.min(365, Number(periodRaw) || 30));
        }

        const courses = await getCourseAnalytics({ periodDays });
        const summary = buildSummary(courses);

        res.json({
            period: periodDays ?? 'all',
            summary,
            courses,
        });
    })
);

/* ═══════════ МОДЕРАЦИЯ ═══════════ */
router.get(
    '/reports',
    safe(async (req, res) => {
        const { status, targetType, page, limit } = req.query;
        res.json(
            await listReports({
                status: status || undefined,
                targetType: targetType || undefined,
                page: Number(page) || 1,
                limit: Number(limit) || 30,
            })
        );
    })
);

router.get(
    '/reports/meta',
    safe(async (_req, res) => {
        res.json({
            targetTypes: REPORT_META.TARGET_TYPES,
            reasons: REPORT_META.REASONS,
            statuses: REPORT_META.STATUSES,
        });
    })
);

router.patch(
    '/reports/:id',
    safe(async (req, res) => {
        const { status, resolution } = req.body;
        const r = await updateReport({
            id: req.params.id,
            status,
            resolution,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.post(
    '/reports/:id/delete-content',
    safe(async (req, res) => {
        const r = await deleteReportedContent({
            reportId: req.params.id,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.post(
    '/reports/:id/ban-user',
    safe(async (req, res) => {
        const r = await banReportedUser({
            reportId: req.params.id,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.delete(
    '/reports/:id',
    safe(async (req, res) => {
        await prisma.report.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ПОЛЬЗОВАТЕЛИ ═══════════ */
router.get(
    '/users',
    safe(async (_req, res) => {
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(users.map(({ passwordHash, ...u }) => u));
    })
);

router.patch(
    '/users/:id',
    safe(async (req, res) => {
        const { role, isBanned, direction } = req.body;
        const allowed = ['STUDENT', 'MENTOR', 'ADMIN'];
        if (role && !allowed.includes(role))
            return res.status(400).json({ error: 'Недопустимая роль' });

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                ...(role && { role }),
                ...(isBanned !== undefined && { isBanned }),
                ...(direction && { direction }),
            },
        });
        const { passwordHash, ...rest } = user;
        res.json(rest);
    })
);

router.patch(
    '/users/:id/password',
    safe(async (req, res) => {
        const { newPassword } = req.body;
        if (!newPassword || String(newPassword).length < 6)
            return res.status(400).json({ error: 'Пароль не короче 6 символов' });

        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.params.id },
            data: {
                passwordHash,
                passwordChangedAt: new Date(),
            },
        });
        res.json({ ok: true, fullName: user.fullName });
    })
);

router.delete(
    '/users/:id',
    safe(async (req, res) => {
        const userId = req.params.id;
        if (userId === req.user.id)
            return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const affectedChatIds = (
            await prisma.chatMember.findMany({
                where: { userId },
                select: { chatId: true },
            })
        ).map((m) => m.chatId);

        await prisma.$transaction(async (tx) => {
            const userMessages = await tx.message.findMany({
                where: { senderId: userId },
                select: { id: true },
            });
            const msgIds = userMessages.map((m) => m.id);

            if (msgIds.length > 0) {
                await tx.message.updateMany({
                    where: { replyToId: { in: msgIds } },
                    data: { replyToId: null },
                });
                await tx.chat.updateMany({
                    where: { pinnedMessageId: { in: msgIds } },
                    data: { pinnedMessageId: null },
                });
                await tx.reaction.deleteMany({ where: { messageId: { in: msgIds } } });
                await tx.message.deleteMany({ where: { id: { in: msgIds } } });
            }

            await tx.comment.deleteMany({ where: { authorId: userId } });
            await tx.postReaction.deleteMany({ where: { userId } });
            await tx.reaction.deleteMany({ where: { userId } });
            await tx.chatMember.deleteMany({ where: { userId } });
            await tx.lessonProgress.deleteMany({ where: { userId } });
            await tx.testAttempt.deleteMany({ where: { userId } });
            await tx.enrollment.deleteMany({ where: { userId } });
            await tx.certificate.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.post.deleteMany({ where: { authorId: userId } });
            await tx.chat.updateMany({
                where: { createdBy: userId },
                data: { createdBy: null },
            });
            await tx.user.delete({ where: { id: userId } });
        });

        const cleanup = await cleanupAfterUserDelete(affectedChatIds);
        res.json({ ok: true, cleanedChats: cleanup.deleted });
    })
);

/* ═══════════ КУРСЫ ═══════════ */
router.get(
    '/courses',
    safe(async (_req, res) => {
        const courses = await prisma.course.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                    include: {
                        test: { include: { questions: true } },
                        practical: {
                            include: {
                                supervisor: { select: { id: true, fullName: true, username: true } },
                            },
                        },
                        homework: true,
                    },
                },
            },
        });
        res.json(courses);
    })
);

router.get(
    '/courses/:id',
    safe(async (req, res) => {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                    include: {
                        test: { include: { questions: true } },
                        practical: {
                            include: {
                                supervisor: { select: { id: true, fullName: true, username: true } },
                            },
                        },
                        homework: true,
                    },
                },
            },
        });
        if (!course) return res.status(404).json({ error: 'Курс не найден' });
        res.json(course);
    })
);

router.post(
    '/courses',
    safe(async (req, res) => {
        const {
            title, slug, description, category, level, cover, published,
            certificateTitle, certificateDescription,
            dripMode, dripInterval, weeklyLessonLimit,
        } = req.body;
        if (!title || !slug)
            return res.status(400).json({ error: 'title и slug обязательны' });

        const course = await prisma.course.create({
            data: {
                title, slug,
                description: description || '',
                category: category || 'photo',
                level: level || 'beginner',
                cover: cover || null,
                published: !!published,
                certificateTitle: certificateTitle || 'Сертификат о прохождении курса',
                certificateDescription: certificateDescription || null,
                dripMode: dripMode || null,
                dripInterval: dripInterval ? Number(dripInterval) : null,
                weeklyLessonLimit: weeklyLessonLimit ? Number(weeklyLessonLimit) : null,
            },
        });
        res.json(course);
    })
);

router.patch(
    '/courses/:id',
    safe(async (req, res) => {
        const allowed = [
            'title', 'description', 'maxFiles', 'maxFileSizeMb',
            'dueAt', 'hoursToComplete', 'latePenaltyPerDay', 'latePenaltyMax',
        ];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === 'maxFiles')
                    data[k] = Math.max(1, Math.min(20, Number(req.body[k]) || 3));
                else if (k === 'maxFileSizeMb')
                    data[k] = Math.max(1, Math.min(500, Number(req.body[k]) || 50));
                else if (k === 'dueAt')
                    data[k] = req.body[k] ? new Date(req.body[k]) : null;
                else if (k === 'hoursToComplete')
                    data[k] = req.body[k] != null
                        ? Math.max(1, Math.min(2000, Number(req.body[k])))
                        : null;
                else if (k === 'latePenaltyPerDay')
                    data[k] = req.body[k] != null
                        ? Math.max(0, Math.min(5, Number(req.body[k])))
                        : 0;
                else if (k === 'latePenaltyMax')
                    data[k] = req.body[k] != null
                        ? Math.max(0, Math.min(5, Number(req.body[k])))
                        : 5;
                else data[k] = req.body[k];
            }
        }

        const course = await prisma.course.update({
            where: { id: req.params.id },
            data,
        });
        res.json(course);
    })
);

router.delete(
    '/courses/:id',
    safe(async (req, res) => {
        await prisma.course.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ УРОКИ ═══════════ */
router.post(
    '/courses/:courseId/lessons',
    safe(async (req, res) => {
        const { title, content, videoUrl, order, duration } = req.body;
        if (!title) return res.status(400).json({ error: 'title обязателен' });
        const lesson = await prisma.lesson.create({
            data: {
                courseId: req.params.courseId, title,
                content: content || '', videoUrl: videoUrl || null,
                order: order ?? 0, duration: duration ?? 0,
            },
        });

        // Уведомляем всех записанных (не блокирует ответ)
        notifyNewLesson({
            courseId: req.params.courseId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonOrder: lesson.order,
        }).catch((e) => console.error('[admin] notify lesson:', e));

        res.json(lesson);
    })
);

router.patch(
    '/lessons/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'content', 'videoUrl', 'order', 'duration'];
        const data = {};
        for (const key of allowed)
            if (req.body[key] !== undefined) data[key] = req.body[key];
        const lesson = await prisma.lesson.update({ where: { id: req.params.id }, data });
        res.json(lesson);
    })
);

router.delete(
    '/lessons/:id',
    safe(async (req, res) => {
        await prisma.lesson.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ТЕСТЫ ═══════════ */
router.post(
    '/lessons/:lessonId/test',
    safe(async (req, res) => {
        const { title, passScore } = req.body;
        const test = await prisma.test.create({
            data: {
                lessonId: req.params.lessonId,
                title: title || 'Тест', passScore: passScore ?? 70,
            },
        });
        res.json(test);
    })
);

router.patch(
    '/tests/:id',
    safe(async (req, res) => {
        const { title, passScore } = req.body;
        const test = await prisma.test.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(passScore !== undefined && { passScore }),
            },
        });
        res.json(test);
    })
);

router.delete(
    '/tests/:id',
    safe(async (req, res) => {
        await prisma.test.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ВОПРОСЫ ═══════════ */
const QUESTION_TYPES = ['single', 'multiple', 'matching', 'text', 'order'];

function validateQuestionPayload(type, p) {
    p = p || {};
    if (type === 'single') {
        if (!Array.isArray(p.options) || p.options.length < 2) throw new Error('single: options ≥ 2');
        if (typeof p.correct !== 'number') throw new Error('single: correct обязателен');
    } else if (type === 'multiple') {
        if (!Array.isArray(p.options) || p.options.length < 2) throw new Error('multiple: options ≥ 2');
        if (!Array.isArray(p.correct) || p.correct.length === 0) throw new Error('multiple: correct[] обязателен');
    } else if (type === 'matching') {
        if (!Array.isArray(p.left) || !Array.isArray(p.right)) throw new Error('matching: left/right обязательны');
        if (!Array.isArray(p.pairs) || p.pairs.length === 0) throw new Error('matching: pairs обязательны');
    } else if (type === 'text') {
        if (typeof p.answer !== 'string' || !p.answer.trim()) throw new Error('text: answer обязателен');
    } else if (type === 'order') {
        if (!Array.isArray(p.items) || p.items.length < 2) throw new Error('order: items ≥ 2');
    }
}

router.post(
    '/tests/:testId/questions',
    safe(async (req, res) => {
        const { type, text, payload, points } = req.body;
        if (!text) return res.status(400).json({ error: 'text обязателен' });
        const qType = QUESTION_TYPES.includes(type) ? type : 'single';
        try { validateQuestionPayload(qType, payload); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        const question = await prisma.question.create({
            data: {
                testId: req.params.testId, type: qType, text,
                payload: JSON.stringify(payload || {}), points: points ?? 1,
            },
        });
        res.json(question);
    })
);

router.patch(
    '/questions/:id',
    safe(async (req, res) => {
        const { type, text, payload, points } = req.body;
        const data = {};
        if (type !== undefined) {
            if (!QUESTION_TYPES.includes(type))
                return res.status(400).json({ error: 'Неверный type' });
            data.type = type;
        }
        if (text !== undefined) data.text = text;
        if (payload !== undefined) {
            const qType = data.type ||
                (await prisma.question.findUnique({ where: { id: req.params.id } })).type;
            try { validateQuestionPayload(qType, payload); }
            catch (e) { return res.status(400).json({ error: e.message }); }
            data.payload = JSON.stringify(payload);
        }
        if (points !== undefined) data.points = points;
        const question = await prisma.question.update({ where: { id: req.params.id }, data });
        res.json(question);
    })
);

router.delete(
    '/questions/:id',
    safe(async (req, res) => {
        await prisma.question.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ СЕРТИФИКАТЫ ═══════════ */
router.get(
    '/certificates',
    safe(async (_req, res) => {
        const certs = await prisma.certificate.findMany({
            orderBy: { issuedAt: 'desc' },
            include: {
                user: { select: { id: true, fullName: true, username: true } },
                course: { select: { id: true, title: true, slug: true } },
            },
        });
        res.json(certs);
    })
);

router.post(
    '/certificates',
    safe(async (req, res) => {
        const { userId, courseId } = req.body;
        if (!userId || !courseId)
            return res.status(400).json({ error: 'Выберите студента и курс' });

        const [user, course] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId } }),
            prisma.course.findUnique({ where: { id: courseId } }),
        ]);
        if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
        if (!course) return res.status(400).json({ error: 'Курс не найден' });

        const existing = await prisma.certificate.findUnique({
            where: { userId_courseId: { userId, courseId } },
        });
        if (existing) return res.status(409).json({ error: 'Сертификат уже выдан' });

        const serial = `MRR-${new Date().getFullYear()}-${Math.random()
            .toString(36).slice(2, 8).toUpperCase()}`;
        const cert = await prisma.certificate.create({
            data: {
                userId, courseId, serial,
                title: course.certificateTitle || `Сертификат о прохождении курса «${course.title}»`,
                description: course.certificateDescription || null,
                template: 'gradient',
            },
            include: {
                user: { select: { id: true, fullName: true, username: true } },
                course: { select: { id: true, title: true, slug: true } },
            },
        });
        res.json(cert);
    })
);

router.patch(
    '/certificates/:id',
    safe(async (req, res) => {
        const allowed = ['serial'];
        const data = {};
        for (const key of allowed)
            if (req.body[key] !== undefined) data[key] = req.body[key];
        try {
            const cert = await prisma.certificate.update({
                where: { id: req.params.id }, data,
                include: {
                    user: { select: { id: true, fullName: true, username: true } },
                    course: { select: { id: true, title: true, slug: true } },
                },
            });
            res.json(cert);
        } catch (e) {
            if (e.code === 'P2002')
                return res.status(409).json({ error: 'Серийный номер уже существует' });
            throw e;
        }
    })
);

router.delete(
    '/certificates/:id',
    safe(async (req, res) => {
        await prisma.certificate.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ НАСТРОЙКИ ═══════════ */
router.get(
    '/settings',
    safe(async (_req, res) => {
        const settings = await prisma.setting.findMany();
        res.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
    })
);

router.put(
    '/settings',
    safe(async (req, res) => {
        const entries = Object.entries(req.body);
        await Promise.all(entries.map(([key, value]) =>
            prisma.setting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            })
        ));
        res.json({ ok: true });
    })
);

/* ═══════════ РАССЫЛКИ ═══════════ */
router.post(
    '/broadcast',
    safe(async (req, res) => {
        const { target, message, title, direction, courseId, group, userIds } = req.body;
        if (!message?.trim())
            return res.status(400).json({ error: 'Введите текст рассылки' });

        let users = [];
        if (target === 'all') {
            users = await prisma.user.findMany({ where: { isBanned: false }, select: { id: true } });
        } else if (target === 'direction') {
            if (!direction) return res.status(400).json({ error: 'Выберите направление' });
            users = await prisma.user.findMany({
                where: { isBanned: false, direction }, select: { id: true },
            });
        } else if (target === 'course') {
            if (!courseId) return res.status(400).json({ error: 'Выберите курс' });
            const enrollments = await prisma.enrollment.findMany({
                where: { courseId },
                include: { user: { select: { id: true, isBanned: true } } },
            });
            users = enrollments.filter((e) => !e.user.isBanned).map((e) => ({ id: e.user.id }));
        } else if (target === 'group') {
            if (!group) return res.status(400).json({ error: 'Укажите группу' });
            users = await prisma.user.findMany({
                where: { isBanned: false, group }, select: { id: true },
            });
        } else if (target === 'custom') {
            if (!Array.isArray(userIds) || userIds.length === 0)
                return res.status(400).json({ error: 'Выберите получателей' });
            users = await prisma.user.findMany({
                where: { id: { in: userIds }, isBanned: false }, select: { id: true },
            });
        } else {
            return res.status(400).json({ error: 'Неизвестная цель' });
        }

        if (!users.length) return res.status(400).json({ error: 'Нет получателей' });

        const payload = {
            title: title?.trim() || 'Сообщение от администрации',
            message: message.trim(),
            fromName: req.user.fullName,
            broadcastAt: new Date().toISOString(),
        };
        await Promise.all(users.map((u) => notifyBroadcast(u.id, payload)));
        res.json({ ok: true, delivered: users.length });
    })
);

router.get(
    '/groups',
    safe(async (_req, res) => {
        const rows = await prisma.user.findMany({
            where: { group: { not: null } },
            select: { group: true },
            distinct: ['group'],
        });
        res.json(rows.map((r) => r.group).filter(Boolean).sort());
    })
);

/* ═══════════ БЭКАПЫ ═══════════ */
router.get(
    '/backups',
    safe(async (_req, res) => {
        res.json(listBackups());
    })
);

router.post(
    '/backups',
    safe(async (req, res) => {
        const { label, format } = req.body || {};
        const fmt = format === 'plain' ? 'plain' : 'custom';
        const r = await createBackup(label, fmt);
        res.json(r);
    })
);

router.post(
    '/backups/restore',
    safe(async (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'filename обязателен' });
        const r = await restoreBackup(filename);
        res.json({ ...r, message: 'База восстановлена. Перезапустите сервер.' });
    })
);

router.delete(
    '/backups/:filename',
    safe(async (req, res) => {
        deleteBackup(req.params.filename);
        res.json({ ok: true });
    })
);

router.get(
    '/backups/:filename/download',
    safe(async (req, res) => {
        const safeName = path.basename(req.params.filename);
        if (!safeName.endsWith('.dump') && !safeName.endsWith('.sql'))
            return res.status(400).json({ error: 'Неверное имя файла' });

        const file = path.join(BACKUPS_DIR, safeName);
        if (!file.startsWith(BACKUPS_DIR))
            return res.status(400).json({ error: 'Неверный путь' });
        if (!fs.existsSync(file))
            return res.status(404).json({ error: 'Файл не найден' });

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
        fs.createReadStream(file).pipe(res);
    })
);

/* ═══════════ ПАКЕТНЫЕ ДЕЙСТВИЯ ═══════════ */

router.post(
    '/bulk/recalc-all',
    safe(async (req, res) => {
        res.json(await recalcAllProgress({ adminId: req.user.id }));
    })
);

router.post(
    '/bulk/issue-certificates',
    safe(async (req, res) => {
        res.json(await issueMissingCertificates({ adminId: req.user.id }));
    })
);

router.post(
    '/bulk/recalc-user-course',
    safe(async (req, res) => {
        const { userId, courseId } = req.body;
        if (!userId || !courseId)
            return res.status(400).json({ error: 'userId и courseId обязательны' });
        res.json(await recalcUserCourse({ adminId: req.user.id, userId, courseId }));
    })
);

router.post(
    '/bulk/enroll',
    safe(async (req, res) => {
        const { courseId, target, direction, group, userIds } = req.body;
        if (!courseId) return res.status(400).json({ error: 'courseId обязателен' });
        res.json(await enrollUsersToCourse({
            adminId: req.user.id, courseId, target, direction, group, userIds,
        }));
    })
);

router.post(
    '/bulk/unenroll',
    safe(async (req, res) => {
        const { courseId, target, direction, group, userIds } = req.body;
        if (!courseId) return res.status(400).json({ error: 'courseId обязателен' });
        res.json(await unenrollUsersFromCourse({
            adminId: req.user.id, courseId, target, direction, group, userIds,
        }));
    })
);

router.post(
    '/bulk/reset-progress',
    safe(async (req, res) => {
        const { courseId, target, direction, group, userIds } = req.body;
        if (!courseId) return res.status(400).json({ error: 'courseId обязателен' });
        res.json(await resetProgressForCourse({
            adminId: req.user.id, courseId, target, direction, group, userIds,
        }));
    })
);

router.post(
    '/bulk/validate-curriculum',
    safe(async (req, res) => {
        const { data } = req.body;
        res.json(validateCurriculum(data));
    })
);

router.post(
    '/bulk/import-curriculum',
    safe(async (req, res) => {
        const { data, mode = 'merge', preserveProgress = false } = req.body;
        if (!Array.isArray(data) || data.length === 0)
            return res.status(400).json({ error: 'Пустой список курсов' });

        const validation = validateCurriculum(data);
        if (!validation.valid) {
            return res.status(400).json({
                error: `Ошибок в структуре: ${validation.totalErrors}`,
                errors: validation.errors,
                stats: validation.stats,
            });
        }

        const result = await importCurriculum({
            adminId: req.user.id, data, mode, preserveProgress,
        });
        res.json({ ...result, validation });
    })
);

router.get(
    '/bulk/export-course/:id',
    safe(async (req, res) => {
        res.json(await exportCourseAsJSON({ adminId: req.user.id, courseId: req.params.id }));
    })
);

router.get(
    '/bulk/export-all-courses',
    safe(async (req, res) => {
        res.json(await exportAllCoursesAsJSON({ adminId: req.user.id }));
    })
);

router.post(
    '/bulk/update-videos',
    safe(async (req, res) => {
        const { updates } = req.body;
        res.json(await updateLessonVideos({ adminId: req.user.id, updates }));
    })
);

router.post(
    '/bulk/export',
    safe(async (req, res) => {
        res.json(await exportSnapshot({ adminId: req.user.id }));
    })
);

router.get(
    '/bulk/actions',
    safe(async (req, res) => {
        const limit = Math.min(500, Number(req.query.limit) || 100);
        const actions = await listActions({ limit });

        const adminIds = [...new Set(actions.map((a) => a.adminId))];
        const admins = await prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, fullName: true, username: true },
        });
        const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

        res.json(
            actions.map((a) => ({
                ...a,
                payload: (() => {
                    try { return JSON.parse(a.payload || '{}'); } catch { return {}; }
                })(),
                admin: adminMap[a.adminId] || { id: a.adminId, fullName: '—', username: '—' },
            }))
        );
    })
);

/* ═══════════ WIKI ═══════════ */

function slugify(title) {
    return (
        String(title || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-zа-я0-9\s-]/gi, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60) +
        '-' +
        Date.now().toString(36).slice(-4)
    );
}

function parseArticle(a) {
    let tags = [];
    try { tags = JSON.parse(a.tags || '[]'); } catch {}
    return { ...a, tags };
}

router.get(
    '/wiki/categories',
    safe(async (_req, res) => {
        const cats = await prisma.wikiCategory.findMany({
            orderBy: { order: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
        res.json(cats.map((c) => ({ ...c, articlesCount: c._count.articles })));
    })
);

router.post(
    '/wiki/categories',
    safe(async (req, res) => {
        const { title, description, icon, order, slug } = req.body;
        if (!title) return res.status(400).json({ error: 'Название обязательно' });
        const cat = await prisma.wikiCategory.create({
            data: {
                title,
                slug: slug || slugify(title),
                description: description || null,
                icon: icon || '📄',
                order: Number(order) || 0,
            },
        });
        res.json(cat);
    })
);

router.patch(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'description', 'icon', 'order'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (data.order !== undefined) data.order = Number(data.order) || 0;
        const cat = await prisma.wikiCategory.update({
            where: { id: req.params.id },
            data,
        });
        res.json(cat);
    })
);

router.delete(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        await prisma.wikiCategory.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

router.get(
    '/wiki/articles',
    safe(async (req, res) => {
        const { category, q } = req.query;
        const where = {};
        if (category) {
            const cat = await prisma.wikiCategory.findUnique({ where: { slug: category } });
            if (cat) where.categoryId = cat.id;
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
            ];
        }

        const articles = await prisma.wikiArticle.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(articles.map(parseArticle));
    })
);

router.get(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const a = await prisma.wikiArticle.findUnique({
            where: { id: req.params.id },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!a) return res.status(404).json({ error: 'Статья не найдена' });
        res.json(parseArticle(a));
    })
);

router.post(
    '/wiki/articles',
    safe(async (req, res) => {
        const { title, slug, excerpt, content, cover, categoryId, tags, published } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'title и content обязательны' });
        }
        const article = await prisma.wikiArticle.create({
            data: {
                title,
                slug: slug || slugify(title),
                excerpt: excerpt || null,
                content,
                cover: cover || null,
                categoryId: categoryId || null,
                authorId: req.user.id,
                tags: JSON.stringify(Array.isArray(tags) ? tags : []),
                published: published !== undefined ? !!published : true,
            },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(parseArticle(article));
    })
);

router.patch(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'excerpt', 'content', 'cover', 'categoryId', 'published'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (req.body.tags !== undefined) {
            data.tags = JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags : []);
        }
        if (data.published !== undefined) data.published = !!data.published;

        const article = await prisma.wikiArticle.update({
            where: { id: req.params.id },
            data,
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(parseArticle(article));
    })
);

router.delete(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        await prisma.wikiArticle.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ PUSH-УВЕДОМЛЕНИЯ ═══════════ */

router.get(
    '/push/stats',
    safe(async (_req, res) => {
        const total = await prisma.pushSubscription.count();
        const uniqueUsers = await prisma.pushSubscription.groupBy({
            by: ['userId'],
        });
        const active7d = await prisma.pushSubscription.count({
            where: { lastUsed: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        res.json({
            totalSubscriptions: total,
            uniqueUsers: uniqueUsers.length,
            activeLast7Days: active7d,
        });
    })
);

router.get(
    '/push/subscriptions',
    safe(async (_req, res) => {
        const subs = await prisma.pushSubscription.findMany({
            orderBy: { lastUsed: 'desc' },
            include: {
                user: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(
            subs.map((s) => ({
                id: s.id,
                userId: s.userId,
                user: s.user,
                endpoint: s.endpoint.slice(0, 60) + '…',
                userAgent: s.userAgent,
                createdAt: s.createdAt,
                lastUsed: s.lastUsed,
            }))
        );
    })
);

router.post(
    '/push/send',
    safe(async (req, res) => {
        const { target, direction, courseId, group, userIds, title, body, url } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'title и body обязательны' });
        }

        const payload = { title, body, url: url || '/app', tag: `admin-${Date.now()}` };

        let userIdsResolved = [];

        if (target === 'all') {
            const rows = await prisma.user.findMany({
                where: { isBanned: false },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'direction') {
            if (!direction) return res.status(400).json({ error: 'Выберите направление' });
            const rows = await prisma.user.findMany({
                where: { isBanned: false, direction },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'course') {
            if (!courseId) return res.status(400).json({ error: 'Выберите курс' });
            const rows = await prisma.enrollment.findMany({
                where: { courseId },
                include: { user: { select: { id: true, isBanned: true } } },
            });
            userIdsResolved = rows.filter((e) => !e.user.isBanned).map((e) => e.user.id);
        } else if (target === 'group') {
            if (!group) return res.status(400).json({ error: 'Укажите группу' });
            const rows = await prisma.user.findMany({
                where: { isBanned: false, group },
                select: { id: true },
            });
            userIdsResolved = rows.map((u) => u.id);
        } else if (target === 'custom') {
            if (!Array.isArray(userIds) || userIds.length === 0)
                return res.status(400).json({ error: 'Выберите получателей' });
            userIdsResolved = userIds;
        } else {
            return res.status(400).json({ error: 'Неизвестная цель' });
        }

        if (userIdsResolved.length === 0)
            return res.status(400).json({ error: 'Нет получателей' });

        let result;
        if (target === 'all') {
            result = await sendPushToAll(payload);
        } else {
            result = await sendPushToUsers(userIdsResolved, payload);
        }

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_broadcast',
                payload: JSON.stringify({ target, title, recipients: userIdsResolved.length }),
                affected: result.sent,
            },
        });

        res.json({
            ok: true,
            recipients: userIdsResolved.length,
            sent: result.sent,
            failed: result.failed,
            gone: result.gone,
        });
    })
);

router.post(
    '/push/test-self',
    safe(async (req, res) => {
        const { title, body } = req.body;
        const r = await sendPushToUser(req.user.id, {
            title: title || 'Тест из админки',
            body: body || 'Пуш работает ✅',
            url: '/app',
            tag: `admin-test-${Date.now()}`,
        });
        res.json(r);
    })
);

/* ═══════════ УПРАВЛЕНИЕ PUSH-ПОДПИСКАМИ ═══════════ */

router.delete(
    '/push/subscriptions/:id',
    safe(async (req, res) => {
        const sub = await prisma.pushSubscription.findUnique({
            where: { id: req.params.id },
        });
        if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });

        await prisma.pushSubscription.delete({ where: { id: sub.id } });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscription_delete',
                payload: JSON.stringify({ subscriptionId: sub.id, userId: sub.userId }),
                affected: 1,
            },
        }).catch(() => {});

        res.json({ ok: true });
    })
);

router.post(
    '/push/subscriptions/delete-many',
    safe(async (req, res) => {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Пустой список' });
        }
        const clean = ids.filter((x) => typeof x === 'string' && x.length > 0);
        if (clean.length === 0) return res.status(400).json({ error: 'Нет валидных id' });

        const result = await prisma.pushSubscription.deleteMany({
            where: { id: { in: clean } },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscriptions_bulk_delete',
                payload: JSON.stringify({ count: clean.length }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, deleted: result.count });
    })
);

router.delete(
    '/push/subscriptions/user/:userId',
    safe(async (req, res) => {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, fullName: true },
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const result = await prisma.pushSubscription.deleteMany({
            where: { userId },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'push_subscriptions_user_delete',
                payload: JSON.stringify({ userId, fullName: user.fullName }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, deleted: result.count });
    })
);

/* ═══════════ АВТООЧИСТКА PUSH-ПОДПИСОК ═══════════ */

router.get(
    '/push/cleanup-settings',
    safe(async (_req, res) => {
        try {
            res.json(await getPushCleanupSettings());
        } catch (e) {
            console.error('[admin] cleanup-settings error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

router.post(
    '/push/cleanup-now',
    safe(async (req, res) => {
        const { dryRun } = req.body || {};
        try {
            const r = await cleanupInactivePushSubscriptions({
                dryRun: !!dryRun,
                trigger: 'manual-force',
            });

            if (!dryRun && r.deleted > 0) {
                await prisma.adminAction.create({
                    data: {
                        adminId: req.user.id,
                        action: 'push_subscriptions_cleanup',
                        payload: JSON.stringify({ days: r.days, deleted: r.deleted }),
                        affected: r.deleted,
                    },
                }).catch(() => {});
            }

            res.json(r);
        } catch (e) {
            console.error('[admin] cleanup-now error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

/* ═══════════ АВТООЧИСТКА УВЕДОМЛЕНИЙ ═══════════ */

router.get(
    '/notifications/cleanup-settings',
    safe(async (_req, res) => {
        try {
            res.json(await getNotifyCleanupSettings());
        } catch (e) {
            console.error('[admin] notify-cleanup-settings error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

router.post(
    '/notifications/cleanup-now',
    safe(async (req, res) => {
        const { dryRun } = req.body || {};
        try {
            const r = await cleanupOldNotifications({
                dryRun: !!dryRun,
                trigger: 'manual-force',
            });

            if (!dryRun && r.deleted > 0) {
                await prisma.adminAction.create({
                    data: {
                        adminId: req.user.id,
                        action: 'notifications_cleanup',
                        payload: JSON.stringify({ days: r.days, deleted: r.deleted }),
                        affected: r.deleted,
                    },
                }).catch(() => {});
            }

            res.json(r);
        } catch (e) {
            console.error('[admin] notify-cleanup-now error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

/* ═══════════ МОДУЛИ ПЛАТФОРМЫ ═══════════ */

router.get(
    '/modules',
    safe(async (_req, res) => {
        const state = await getModulesState();
        res.json({
            modules: MODULES.map((m) => ({
                key: m.key,
                label: m.label,
                icon: m.icon,
                description: m.description,
                enabled: state[m.key],
            })),
        });
    })
);

router.put(
    '/modules',
    safe(async (req, res) => {
        const { modules } = req.body;
        if (!modules || typeof modules !== 'object') {
            return res.status(400).json({ error: 'modules обязателен' });
        }

        const current = await getModulesState();
        const next = { ...current, ...modules };
        const anyEnabled = Object.values(next).some(Boolean);
        if (!anyEnabled) {
            return res.status(400).json({ error: 'Хотя бы один модуль должен быть включён' });
        }

        for (const [key, enabled] of Object.entries(modules)) {
            await setModuleEnabled(key, !!enabled);
        }

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'modules_update',
                payload: JSON.stringify(modules),
                affected: Object.keys(modules).length,
            },
        }).catch(() => {});

        res.json({ ok: true });
    })
);

/* ═══════════ ОНБОРДИНГ ═══════════ */

router.get(
    '/onboarding/info',
    safe(async (_req, res) => {
        const [needsOnboarding, completed, total] = await Promise.all([
            prisma.user.count({ where: { onboardingVersion: { lt: ONBOARDING_VERSION } } }),
            prisma.user.count({ where: { onboardingVersion: { gte: ONBOARDING_VERSION } } }),
            prisma.user.count(),
        ]);

        res.json({
            currentVersion: ONBOARDING_VERSION,
            steps: ONBOARDING_STEPS,
            stats: { needsOnboarding, completed, total },
        });
    })
);

router.post(
    '/onboarding/reset-all',
    safe(async (req, res) => {
        const r = await prisma.user.updateMany({ data: { onboardingVersion: 0 } });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'onboarding_reset_all',
                payload: JSON.stringify({}),
                affected: r.count,
            },
        }).catch(() => {});

        res.json({ ok: true, affected: r.count });
    })
);

router.post(
    '/onboarding/reset-user/:userId',
    safe(async (req, res) => {
        const user = await prisma.user.findUnique({
            where: { id: req.params.userId },
            select: { id: true, fullName: true },
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        await prisma.user.update({
            where: { id: user.id },
            data: { onboardingVersion: 0 },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'onboarding_reset_user',
                payload: JSON.stringify({ userId: user.id, fullName: user.fullName }),
                affected: 1,
            },
        }).catch(() => {});

        res.json({ ok: true });
    })
);

/* ═══════════ ВОССТАНОВЛЕНИЕ ПАРОЛЯ ═══════════ */

router.get(
    '/password-resets',
    safe(async (req, res) => {
        const { status } = req.query;
        const [items, stats] = await Promise.all([
            listResetRequests({ status: status || undefined }),
            getPasswordResetStats(),
        ]);
        res.json({ items, stats });
    })
);

router.post(
    '/password-resets/:id/generate-code',
    safe(async (req, res) => {
        const { note } = req.body || {};
        try {
            const r = await generateCodeForRequest({
                requestId: req.params.id,
                adminId: req.user.id,
                note,
            });
            await prisma.adminAction.create({
                data: {
                    adminId: req.user.id,
                    action: 'password_reset_generate_code',
                    payload: JSON.stringify({ requestId: req.params.id }),
                    affected: 1,
                },
            }).catch(() => {});
            res.json(r);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

router.post(
    '/password-resets/:id/reject',
    safe(async (req, res) => {
        const { note } = req.body || {};
        try {
            const r = await rejectRequest({
                requestId: req.params.id,
                adminId: req.user.id,
                note,
            });
            await prisma.adminAction.create({
                data: {
                    adminId: req.user.id,
                    action: 'password_reset_reject',
                    payload: JSON.stringify({ requestId: req.params.id }),
                    affected: 1,
                },
            }).catch(() => {});
            res.json(r);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

/* ═══════════ ГЕЙМИФИКАЦИЯ ═══════════ */

router.get('/gamification/settings', safe(async (_req, res) => {
    res.json(await getGamifSettings());
}));

router.put('/gamification/settings', safe(async (req, res) => {
    const updated = await updateGamifSettings(req.body || {});
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_settings_update',
            payload: JSON.stringify(req.body || {}),
            affected: 1,
        },
    }).catch(() => {});
    res.json(updated);
}));

router.get('/gamification/overview', safe(async (_req, res) => {
    res.json(await getAdminOverview());
}));

router.get('/gamification/catalog', safe(async (_req, res) => {
    res.json({
        xpDefaults: XP_DEFAULTS,
        deductionDefaults: DEDUCTION_DEFAULTS,
        questTemplates: QUEST_TEMPLATES,
        rarities: RARITIES,
        counterOptions: COUNTER_OPTIONS,
        defaultLevels: DEFAULT_LEVEL_THRESHOLDS,
    });
}));

router.post('/gamification/grant-xp', safe(async (req, res) => {
    const { userId, amount, reason } = req.body;
    if (!userId || amount === undefined || Number(amount) === 0)
        return res.status(400).json({ error: 'userId и amount обязательны' });
    const r = await adminGrantXp(userId, Number(amount), reason || 'admin_grant');
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_grant_xp',
            payload: JSON.stringify({ userId, amount: Number(amount) }),
            affected: 1,
        },
    }).catch(() => {});
    res.json(r);
}));

router.post('/gamification/reset-user/:userId', safe(async (req, res) => {
    await adminResetUser(req.params.userId);
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_reset_user',
            payload: JSON.stringify({ userId: req.params.userId }),
            affected: 1,
        },
    }).catch(() => {});
    res.json({ ok: true });
}));

router.post('/gamification/reset-all', safe(async (req, res) => {
    await adminResetAll();
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_reset_all',
            payload: JSON.stringify({}),
            affected: 0,
        },
    }).catch(() => {});
    res.json({ ok: true });
}));

/* ─── Достижения ─── */

router.get('/gamification/achievements', safe(async (_req, res) => {
    res.json({ achievements: await listAchievements() });
}));

router.post('/gamification/achievements', safe(async (req, res) => {
    try {
        const a = await createAchievement(req.body || {});
        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'gamification_achievement_create',
                payload: JSON.stringify({ id: a.id, title: a.title }),
                affected: 1,
            },
        }).catch(() => {});
        res.json(a);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.patch('/gamification/achievements/:id', safe(async (req, res) => {
    try {
        const a = await updateAchievement(req.params.id, req.body || {});
        res.json(a);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.delete('/gamification/achievements/:id', safe(async (req, res) => {
    try {
        await deleteAchievement(req.params.id);
        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'gamification_achievement_delete',
                payload: JSON.stringify({ id: req.params.id }),
                affected: 1,
            },
        }).catch(() => {});
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}));

router.post('/gamification/achievements/reset-defaults', safe(async (_req, res) => {
    const list = await resetAchievementsToDefaults();
    res.json({ ok: true, achievements: list });
}));

/* ─── Уровни ─── */

router.get('/gamification/levels', safe(async (_req, res) => {
    const s = await getGamifSettings();
    res.json({
        thresholds: s.levelThresholds,
        defaultThresholds: DEFAULT_LEVEL_THRESHOLDS,
    });
}));

router.put('/gamification/levels', safe(async (req, res) => {
    const { thresholds } = req.body || {};
    if (!Array.isArray(thresholds))
        return res.status(400).json({ error: 'thresholds должен быть массивом' });
    const updated = await updateGamifSettings({ levelThresholds: thresholds });
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_levels_update',
            payload: JSON.stringify({ count: thresholds.length }),
            affected: 1,
        },
    }).catch(() => {});
    res.json({ ok: true, thresholds: updated.levelThresholds });
}));

router.post('/gamification/levels/reset-defaults', safe(async (_req, res) => {
    const updated = await updateGamifSettings({ levelThresholds: DEFAULT_LEVEL_THRESHOLDS });
    res.json({ ok: true, thresholds: updated.levelThresholds });
}));

/* ─── Шаблоны квестов ─── */

const QUEST_TYPES = [
    'post_count', 'comment_count', 'lesson_count',
    'test_pass', 'reaction_given', 'certificate_earned',
];

router.get('/gamification/quest-templates', safe(async (_req, res) => {
    const count = await prisma.questTemplate.count();
    if (count === 0) {
        await prisma.questTemplate.createMany({ data: QUEST_TEMPLATES });
    }
    const templates = await prisma.questTemplate.findMany({
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ templates, types: QUEST_TYPES });
}));

router.post('/gamification/quest-templates', safe(async (req, res) => {
    const { type, target, xpReward, label, icon, weight, active } = req.body || {};
    if (!type || !QUEST_TYPES.includes(type))
        return res.status(400).json({ error: 'Недопустимый тип квеста' });
    const created = await prisma.questTemplate.create({
        data: {
            type,
            target: Math.max(1, Math.min(100, Number(target) || 1)),
            xpReward: Math.max(1, Math.min(10000, Number(xpReward) || 10)),
            label: label ? String(label).slice(0, 100) : null,
            icon: icon ? String(icon).slice(0, 10) : null,
            weight: Math.max(1, Math.min(100, Number(weight) || 1)),
            active: active !== false,
        },
    });
    res.json(created);
}));

router.patch('/gamification/quest-templates/:id', safe(async (req, res) => {
    const { type, target, xpReward, label, icon, weight, active } = req.body || {};
    const data = {};
    if (type !== undefined) {
        if (!QUEST_TYPES.includes(type)) return res.status(400).json({ error: 'Недопустимый тип' });
        data.type = type;
    }
    if (target !== undefined) data.target = Math.max(1, Math.min(100, Number(target) || 1));
    if (xpReward !== undefined) data.xpReward = Math.max(1, Math.min(10000, Number(xpReward) || 1));
    if (label !== undefined) data.label = label ? String(label).slice(0, 100) : null;
    if (icon !== undefined) data.icon = icon ? String(icon).slice(0, 10) : null;
    if (weight !== undefined) data.weight = Math.max(1, Math.min(100, Number(weight) || 1));
    if (active !== undefined) data.active = !!active;
    res.json(await prisma.questTemplate.update({ where: { id: req.params.id }, data }));
}));

router.delete('/gamification/quest-templates/:id', safe(async (req, res) => {
    await prisma.questTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}));

router.post('/gamification/quest-templates/reset-defaults', safe(async (_req, res) => {
    await prisma.questTemplate.deleteMany({});
    await prisma.questTemplate.createMany({ data: QUEST_TEMPLATES });
    const templates = await prisma.questTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ ok: true, templates });
}));

router.post('/gamification/quests/regenerate-all', safe(async (req, res) => {
    const today = new Date();
    const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const del = await prisma.dailyQuest.deleteMany({ where: { date: todayKey } });
    await prisma.adminAction.create({
        data: {
            adminId: req.user.id,
            action: 'gamification_quests_regenerate_all',
            payload: JSON.stringify({ date: todayKey }),
            affected: del.count,
        },
    }).catch(() => {});
    res.json({ ok: true, deleted: del.count, date: todayKey });
}));

/* ═══════════ ПРАКТИКИ ═══════════ */

router.get(
    '/mentors',
    safe(async (_req, res) => {
        const users = await prisma.user.findMany({
            where: { role: { in: ['MENTOR', 'ADMIN'] }, isBanned: false },
            select: { id: true, fullName: true, username: true, role: true },
            orderBy: { fullName: 'asc' },
        });
        res.json(users);
    })
);

router.post(
    '/lessons/:lessonId/practical',
    safe(async (req, res) => {
        const { topic, description, location, scheduledAt, durationMin, supervisorId } = req.body;
        if (!topic || !description) {
            return res.status(400).json({ error: 'topic и description обязательны' });
            if (practical.scheduledAt) {
                notifyPracticalScheduled({ practicalId: practical.id, isUpdate: false })
                    .catch((e) => console.error('[admin] notify practical:', e));
            }
        }

        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.lessonId },
        });
        if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

        const data = {
            topic,
            description,
            location: location || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            durationMin: Number(durationMin) || 90,
            supervisorId: supervisorId || null,
        };

        const practical = await prisma.practicalWork.upsert({
            where: { lessonId: lesson.id },
            update: data,
            create: { ...data, lessonId: lesson.id, courseId: lesson.courseId },
        });

        await prisma.lesson.update({
            where: { id: lesson.id },
            data: { requiresPractical: true },
        });

        res.json(practical);
    })
);

router.patch(
    '/practicals/:id',
    safe(async (req, res) => {
        const allowed = ['topic', 'description', 'location', 'scheduledAt', 'durationMin', 'supervisorId'];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === 'scheduledAt') {
                    data[k] = req.body[k] ? new Date(req.body[k]) : null;
                } else if (k === 'durationMin') {
                    data[k] = Number(req.body[k]) || 90;
                } else {
                    data[k] = req.body[k] || null;
                }
            }
        }

        // Сохраняем прежнее значение, чтобы понять, «первая» это установка даты или изменение
        const before = await prisma.practicalWork.findUnique({
            where: { id: req.params.id },
            select: { scheduledAt: true },
        });

        const practical = await prisma.practicalWork.update({
            where: { id: req.params.id },
            data,
        });

        // Уведомляем только если дата появилась впервые
        if (!before?.scheduledAt && practical.scheduledAt) {
            notifyPracticalScheduled({ practicalId: practical.id, isUpdate: false })
                .catch((e) => console.error('[admin] notify practical:', e));
        }

        res.json(practical);
    })
);

router.delete(
    '/practicals/:id',
    safe(async (req, res) => {
        const practical = await prisma.practicalWork.findUnique({
            where: { id: req.params.id },
        });
        if (!practical) return res.status(404).json({ error: 'Практика не найдена' });

        await prisma.practicalWork.delete({ where: { id: practical.id } });
        await prisma.lesson.update({
            where: { id: practical.lessonId },
            data: { requiresPractical: false },
        });

        res.json({ ok: true });
    })
);

/* ═══════════ ДОМАШНИЕ ЗАДАНИЯ ═══════════ */

router.post(
    '/lessons/:lessonId/homework',
    safe(async (req, res) => {
        const { title, description, maxFiles, maxFileSizeMb } = req.body;
        if (!title || !description) {
            return res.status(400).json({ error: 'title и description обязательны' });
        }

        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.lessonId },
        });
        if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

        const data = {
            title,
            description,
            maxFiles: Math.max(1, Math.min(20, Number(maxFiles) || 3)),
            maxFileSizeMb: Math.max(1, Math.min(500, Number(maxFileSizeMb) || 50)),
            dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
            hoursToComplete: req.body.hoursToComplete != null
                ? Math.max(1, Math.min(2000, Number(req.body.hoursToComplete)))
                : null,
            latePenaltyPerDay: req.body.latePenaltyPerDay != null
                ? Math.max(0, Math.min(5, Number(req.body.latePenaltyPerDay)))
                : 0,
            latePenaltyMax: req.body.latePenaltyMax != null
                ? Math.max(0, Math.min(5, Number(req.body.latePenaltyMax)))
                : 5,
        };

        const homework = await prisma.homework.upsert({
            where: { lessonId: lesson.id },
            update: data,
            create: { ...data, lessonId: lesson.id },
        });

        res.json(homework);
    })
);

router.patch(
    '/homework/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'description', 'maxFiles', 'maxFileSizeMb', 'dueAt', 'hoursToComplete'];
        const data = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === 'maxFiles') data[k] = Math.max(1, Math.min(20, Number(req.body[k]) || 3));
                else if (k === 'maxFileSizeMb') data[k] = Math.max(1, Math.min(500, Number(req.body[k]) || 50));
                else if (k === 'dueAt') data[k] = req.body[k] ? new Date(req.body[k]) : null;
                else if (k === 'hoursToComplete') {
                    data[k] = req.body[k] != null
                        ? Math.max(1, Math.min(2000, Number(req.body[k])))
                        : null;
                }
                else data[k] = req.body[k];
            }
        }
        const homework = await prisma.homework.update({
            where: { id: req.params.id },
            data,
        });
        res.json(homework);
    })
);

router.delete(
    '/homework/:id',
    safe(async (req, res) => {
        await prisma.homework.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

/* ═══════════ ПРАКТИКИ И ДЗ (обзорная вкладка) ═══════════ */

router.get(
    '/practicals-list',
    safe(async (_req, res) => {
        const practicals = await prisma.practicalWork.findMany({
            orderBy: [{ courseId: 'asc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }],
            include: {
                course: { select: { id: true, slug: true, title: true } },
                lesson: { select: { id: true, title: true, order: true } },
                supervisor: { select: { id: true, fullName: true, username: true } },
                submissions: { select: { status: true } },
            },
        });

        res.json(
            practicals.map((p) => {
                const total = p.submissions.length;
                const pending = p.submissions.filter((s) => s.status === 'PENDING').length;
                const approved = p.submissions.filter((s) => s.status === 'APPROVED').length;
                const rejected = p.submissions.filter((s) => s.status === 'REJECTED').length;
                return {
                    id: p.id,
                    courseId: p.courseId,
                    course: p.course,
                    lesson: p.lesson,
                    topic: p.topic,
                    description: p.description,
                    location: p.location,
                    scheduledAt: p.scheduledAt,
                    durationMin: p.durationMin,
                    supervisorId: p.supervisorId,
                    supervisor: p.supervisor,
                    totalCount: total,
                    pendingCount: pending,
                    approvedCount: approved,
                    rejectedCount: rejected,
                };
            })
        );
    })
);

router.get(
    '/homeworks-list',
    safe(async (_req, res) => {
        const homeworks = await prisma.homework.findMany({
            orderBy: [{ createdAt: 'asc' }],
            include: {
                lesson: {
                    select: {
                        id: true,
                        title: true,
                        order: true,
                        course: { select: { id: true, slug: true, title: true } },
                    },
                },
                submissions: { select: { status: true } },
            },
        });

        res.json(
            homeworks.map((h) => {
                const total = h.submissions.length;
                const pending = h.submissions.filter((s) => s.status === 'PENDING').length;
                const approved = h.submissions.filter((s) => s.status === 'APPROVED').length;
                const rejected = h.submissions.filter((s) => s.status === 'REJECTED').length;
                return {
                    id: h.id,
                    lessonId: h.lessonId,
                    lesson: h.lesson,
                    title: h.title,
                    description: h.description,
                    maxFiles: h.maxFiles,
                    maxFileSizeMb: h.maxFileSizeMb,
                    totalCount: total,
                    pendingCount: pending,
                    approvedCount: approved,
                    rejectedCount: rejected,
                };
            })
        );
    })
);

router.post(
    '/practicals/bulk-assign-supervisor',
    safe(async (req, res) => {
        const { courseId, supervisorId } = req.body || {};
        if (!courseId) return res.status(400).json({ error: 'courseId обязателен' });

        const result = await prisma.practicalWork.updateMany({
            where: { courseId },
            data: { supervisorId: supervisorId || null },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'practicals_bulk_assign_supervisor',
                payload: JSON.stringify({ courseId, supervisorId }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, affected: result.count });
    })
);

router.post(
    '/homeworks/bulk-delete',
    safe(async (req, res) => {
        const { courseId } = req.body || {};
        if (!courseId) return res.status(400).json({ error: 'courseId обязателен' });

        const result = await prisma.homework.deleteMany({
            where: { lesson: { courseId } },
        });

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'homeworks_bulk_delete',
                payload: JSON.stringify({ courseId }),
                affected: result.count,
            },
        }).catch(() => {});

        res.json({ ok: true, affected: result.count });
    })
);

export default router;