import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
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
} from '../../lib/bulkActions.js';
import { safe } from './_shared.js';

const router = Router();

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

export default router;