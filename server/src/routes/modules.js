import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getModulesState } from '../lib/modules.js';

const router = Router();
router.use(auth);

/* Текущее состояние модулей — используется клиентом для фильтрации навигации */
router.get('/', async (_req, res) => {
    try {
        res.json({ modules: await getModulesState() });
    } catch (e) {
        console.error('[modules] error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;