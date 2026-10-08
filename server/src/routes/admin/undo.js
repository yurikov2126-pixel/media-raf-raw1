import { Router } from 'express';
import { safe } from './_shared.js';
import { undoPendingDeletion } from '../../lib/pendingDeletion.js';

const router = Router();

router.post(
    '/undo/:token',
    safe(async (req, res) => {
        const result = await undoPendingDeletion(req.params.token);
        if (!result.ok) {
            const status = result.reason === 'not_found' ? 404 : 410; // 410 Gone
            const message =
                result.reason === 'not_found'
                    ? 'Запись не найдена'
                    : 'Время отмены истекло, удаление уже выполнено';
            return res.status(status).json({ error: message });
        }
        res.json({ ok: true, ...result });
    })
);

export default router;