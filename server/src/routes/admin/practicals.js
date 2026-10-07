import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { notifyPracticalScheduled } from '../../lib/notificationEvents.js';
import { safe } from './_shared.js';

const router = Router();

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
        }

        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.lessonId },
        });
        if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

        // Смотрим состояние ДО upsert — чтобы понять,
        // устанавливается ли дата практики впервые.
        const before = await prisma.practicalWork.findUnique({
            where: { lessonId: lesson.id },
            select: { scheduledAt: true },
        });

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

        // Уведомляем только если дата появилась впервые
        // (тот же паттерн, что в PATCH /practicals/:id).
        if (!before?.scheduledAt && practical.scheduledAt) {
            notifyPracticalScheduled({ practicalId: practical.id, isUpdate: false })
                .catch((e) => console.error('[admin] notify practical:', e));
        }

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

/* ═══════════ ПРАКТИКИ (обзорная вкладка) ═══════════ */

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

export default router;