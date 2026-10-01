import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
    getPublicKey,
    saveSubscription,
    removeSubscription,
    sendPushToUser,
} from '../lib/push.js';

const router = Router();

// Публичный VAPID-ключ (нужен до подписки)
router.get('/vapid-public-key', (_req, res) => {
    const key = getPublicKey();
    if (!key) return res.status(503).json({ error: 'Push-сервис не настроен' });
    res.json({ key });
});

// Сохранить подписку
router.post('/subscribe', auth, async (req, res) => {
    try {
        const { subscription } = req.body;
        const saved = await saveSubscription(
            req.user.id,
            subscription,
            req.headers['user-agent']
        );

        // Тестовое приветственное уведомление
        try {
            await sendPushToUser(req.user.id, {
                title: 'MEDIA·RAF·RAW',
                body: '🔔 Уведомления включены!',
                url: '/app',
                tag: 'welcome-push',
            });
        } catch {}

        res.json({ ok: true, id: saved.id });
    } catch (e) {
        console.error('[push] subscribe error:', e);
        res.status(400).json({ error: e.message });
    }
});

// Отписка
router.post('/unsubscribe', auth, async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) await removeSubscription(endpoint);
    res.json({ ok: true });
});

// Проверка статуса
router.get('/status', auth, async (_req, res) => {
    res.json({
        configured: !!getPublicKey(),
        vapidPublicKey: getPublicKey(),
    });
});

// Тестовое уведомление (для отладки)
router.post('/test', auth, async (req, res) => {
    const r = await sendPushToUser(req.user.id, {
        title: 'Тестовое уведомление',
        body: 'Если вы видите это — push работает',
        url: '/app',
        tag: `test-${Date.now()}`,
    });
    res.json(r);
});

export default router;