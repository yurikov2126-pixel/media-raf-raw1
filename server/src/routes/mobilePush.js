import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Register or refresh this Android installation for the authenticated user.
router.post('/register', auth, async (req, res) => {
    const { token } = req.body || {};
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
        return res.status(400).json({ error: 'Некорректный FCM-токен' });
    }
    try {
        await prisma.mobilePushToken.upsert({
            where: { token },
            create: { userId: req.user.id, token, platform: 'android' },
            update: { userId: req.user.id, lastUsed: new Date() },
        });
        return res.json({ ok: true });
    } catch (error) {
        console.error('[mobile-push] register failed:', error.message);
        return res.status(500).json({ error: 'Не удалось зарегистрировать устройство' });
    }
});

// Revoke only a token belonging to the authenticated user.
router.post('/unregister', auth, async (req, res) => {
    const { token } = req.body || {};
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
        return res.status(400).json({ error: 'Некорректный FCM-токен' });
    }
    try {
        await prisma.mobilePushToken.deleteMany({
            where: { userId: req.user.id, token },
        });
        return res.json({ ok: true });
    } catch (error) {
        console.error('[mobile-push] unregister failed:', error.message);
        return res.status(500).json({ error: 'Не удалось удалить устройство' });
    }
});

export default router;
