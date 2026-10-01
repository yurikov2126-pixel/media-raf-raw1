import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/certificates/:serial', async (req, res) => {
    const cert = await prisma.certificate.findUnique({
        where: { serial: req.params.serial },
        include: {
            user: { select: { fullName: true, username: true } },
            course: { select: { title: true, slug: true, category: true } },
        },
    });
    if (!cert) return res.status(404).json({ error: 'Сертификат не найден' });
    res.json({
        serial: cert.serial,
        issuedAt: cert.issuedAt,
        title: cert.title,
        description: cert.description,
        user: cert.user,
        course: cert.course,
    });
});

export default router;