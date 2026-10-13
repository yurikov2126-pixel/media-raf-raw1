import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth);

export const DASHBOARD_WIDGETS = [
    'learning', 'tasks', 'wiki', 'progress', 'quickActions', 'profile', 'feed',
];
export const DEFAULT_WIDGETS = ['learning', 'tasks', 'wiki', 'progress', 'quickActions'];
const settingKey = id => 'dashboard2_user_' + id;

function sanitize(value) {
    if (!Array.isArray(value) || value.length > DASHBOARD_WIDGETS.length ||
        value.some(key => typeof key !== 'string' || !DASHBOARD_WIDGETS.includes(key))) {
        return null;
    }
    return [...new Set(value)];
}

router.get('/', async (req, res, next) => {
    try {
        const saved = await prisma.setting.findUnique({ where: { key: settingKey(req.user.id) } });
        let parsed = DEFAULT_WIDGETS;
        if (saved?.value) {
            try { parsed = sanitize(JSON.parse(saved.value)) ?? DEFAULT_WIDGETS; }
            catch { parsed = DEFAULT_WIDGETS; }
        }
        res.json({ widgets: parsed, available: DASHBOARD_WIDGETS });
    } catch (error) { next(error); }
});

router.put('/', async (req, res, next) => {
    try {
        const widgets = sanitize(req.body?.widgets);
        if (!widgets) return res.status(400).json({ error: 'Недопустимый набор виджетов' });
        await prisma.setting.upsert({
            where: { key: settingKey(req.user.id) },
            update: { value: JSON.stringify(widgets) },
            create: { key: settingKey(req.user.id), value: JSON.stringify(widgets) },
        });
        res.json({ widgets });
    } catch (error) { next(error); }
});

export default router;
