import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { createReport, REPORT_META } from '../lib/moderation.js';

const router = Router();
router.use(auth);

/* Метаданные для формы (типы, причины) */
router.get('/meta', (_req, res) => {
    res.json({
        targetTypes: REPORT_META.TARGET_TYPES,
        reasons: REPORT_META.REASONS,
    });
});

/* Создать жалобу */
router.post('/', async (req, res) => {
    try {
        const { targetType, targetId, reason, comment } = req.body;
        const r = await createReport({
            reporterId: req.user.id,
            targetType,
            targetId,
            reason,
            comment,
        });
        res.json(r);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

export default router;