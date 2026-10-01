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
} from '../lib/backup.js';
import { cleanupAfterUserDelete, getLiveChatStats } from '../lib/chatCleanup.js';
import { scanDatabase, cleanupDatabase } from '../lib/dbMaintenance.js';
import { getAnalytics } from '../lib/analytics.js';
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

/* ─────────── Дашборд ─────────── */
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

/* ─────────── Обслуживание БД ─────────── */
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

/* ─────────── Аналитика ─────────── */
router.get(
    '/analytics',
    safe(async (req, res) => {
        const period = Math.max(7, Math.min(365, Number(req.query.period) || 30));
        res.json(await getAnalytics(period));
    })
);

/* ─────────── Пользователи ─────────── */
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
            data: { passwordHash },
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

/* ─────────── Курсы ─────────── */
router.get(
    '/courses',
    safe(async (_req, res) => {
        const courses = await prisma.course.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                    include: { test: { include: { questions: true } } },
                },
                _count: { select: { enrollments: true, certificates: true } },
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
                    include: { test: { include: { questions: true } } },
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
            certificateTitle, certificateDescription, dripMode, dripInterval,
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
            },
        });
        res.json(course);
    })
);

router.patch(
    '/courses/:id',
    safe(async (req, res) => {
        const allowed = [
            'title', 'slug', 'description', 'category', 'level', 'cover', 'published',
            'certificateTitle', 'certificateDescription', 'dripMode', 'dripInterval',
        ];
        const data = {};
        for (const key of allowed)
            if (req.body[key] !== undefined) data[key] = req.body[key];

        if (data.dripMode !== undefined && data.dripMode === '') data.dripMode = null;
        if (data.dripInterval !== undefined) {
            if (data.dripInterval === null || data.dripInterval === '')
                data.dripInterval = null;
            else data.dripInterval = Number(data.dripInterval) || 7;
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

/* ─────────── Уроки ─────────── */
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

/* ─────────── Тесты ─────────── */
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

/* ─────────── Вопросы ─────────── */
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

/* ─────────── Сертификаты ─────────── */
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

/* ─────────── Настройки ─────────── */
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

/* ─────────── Рассылки ─────────── */
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

/* ─────────── Бэкапы ─────────── */
router.get(
    '/backups',
    safe(async (_req, res) => {
        res.json(listBackups());
    })
);

router.post(
    '/backups',
    safe(async (req, res) => {
        const { label } = req.body || {};
        res.json(createBackup(label));
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
        if (!safeName.endsWith('.db'))
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

/* ─────────── Пакетные действия ─────────── */

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

/* ─────────── Wiki ─────────── */

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
                { title: { contains: q } },
                { content: { contains: q } },
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

/* ─────────── Push-уведомления ─────────── */

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

export default router;