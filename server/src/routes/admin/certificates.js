import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();

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

export default router;