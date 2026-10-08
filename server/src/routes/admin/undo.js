import { Router } from 'express';
import { safe } from './_shared.js';
import { prisma } from '../../lib/prisma.js';
import { undoPendingDeletion } from '../../lib/pendingDeletion.js';

const router = Router();

router.post(
    '/undo/:token',
    safe(async (req, res) => {
        const result = await undoPendingDeletion(req.params.token);

        if (!result.ok) {
            const status = result.reason === 'not_found' ? 404 : 410;
            const message =
                result.reason === 'not_found'
                    ? 'Запись не найдена'
                    : 'Время отмены истекло, удаление уже выполнено';
            return res.status(status).json({ error: message });
        }

        // Аудит: кто и когда отменил удаление.
        await prisma.adminAction
            .create({
                data: {
                    adminId: req.user.id,
                    action: `undo_delete_${result.entityType}`,
                    payload: JSON.stringify({
                        entityId: result.entityId,
                        undoToken: req.params.token,
                    }),
                    affected: 1,
                },
            })
            .catch(() => {});

        res.json({ ok: true, ...result });
    })
);

export default router;