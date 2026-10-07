import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();

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

/* ═══════════ ДОМАШКИ (обзорная вкладка) ═══════════ */

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