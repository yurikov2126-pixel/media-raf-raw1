import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { ONBOARDING_VERSION, getStepsForUser } from '../lib/onboarding.js';

const router = Router();
router.use(auth);

/* Конфигурация онбординга для текущего пользователя */
router.get('/config', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { onboardingVersion: true },
        });
        const userVersion = user?.onboardingVersion ?? 0;

        const steps = await getStepsForUser(userVersion);

        res.json({
            version: ONBOARDING_VERSION,
            userVersion,
            needsOnboarding: steps.length > 0,
            steps,
        });
    } catch (e) {
        console.error('[onboarding] config error:', e);
        res.status(500).json({ error: e.message });
    }
});

/* Отметить онбординг как пройденный */
router.post('/complete', async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { onboardingVersion: ONBOARDING_VERSION },
        });
        res.json({ ok: true, version: ONBOARDING_VERSION });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;