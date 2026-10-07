import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ONBOARDING_VERSION, ONBOARDING_STEPS } from '../../lib/onboarding.js';
import { safe } from './_shared.js';

const router = Router();

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

export default router;