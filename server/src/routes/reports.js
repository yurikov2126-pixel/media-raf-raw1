import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createReport, REPORT_META, applyAutoModeration } from '../lib/moderation.js';
import { createNotification } from '../lib/notify.js';

const router = Router();
router.use(auth);

/* Метаданные формы */
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
        const report = await createReport({
            reporterId: req.user.id,
            targetType,
            targetId,
            reason,
            comment,
        });

        // Автомодерация (пороги из Setting). Не критично, если упадёт —
        // жалоба уже создана, ручная модерация увидит её в админке.
        let auto = { applied: false };
        try {
            auto = await applyAutoModeration({ report });
        } catch (e) {
            console.error('[reports] auto-moderation failed:', e);
        }

        // Уведомляем всех админов (кроме самого жалобщика, если он админ).
        // Тип 'report' — на клиенте будет иконка 🚩 и переход в админку.
        try {
            const admins = await prisma.user.findMany({
                where: { role: 'ADMIN', isBanned: false, NOT: { id: req.user.id } },
                select: { id: true },
            });
            const targetLabel =
                targetType === 'post'
                    ? 'пост'
                    : targetType === 'comment'
                        ? 'комментарий'
                        : targetType === 'message'
                            ? 'сообщение'
                            : 'пользователя';
            for (const a of admins) {
                await createNotification(a.id, 'report', {
                    reportId: report.id,
                    targetType,
                    targetId,
                    reason,
                    reporterName: req.user.fullName,
                    reporterUsername: req.user.username,
                    targetLabel,
                    autoAction: auto.applied ? auto.action : null,
                });
            }
        } catch (e) {
            console.error('[reports] notify admins failed:', e);
        }

        res.json({ report, auto });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

export default router;