import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
    getNotifyCleanupSettings,
    cleanupOldNotifications,
} from '../../lib/notifyCleanup.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ АВТООЧИСТКА УВЕДОМЛЕНИЙ ═══════════ */

router.get(
    '/notifications/cleanup-settings',
    safe(async (_req, res) => {
        try {
            res.json(await getNotifyCleanupSettings());
        } catch (e) {
            console.error('[admin] notify-cleanup-settings error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

router.post(
    '/notifications/cleanup-now',
    safe(async (req, res) => {
        const { dryRun } = req.body || {};
        try {
            const r = await cleanupOldNotifications({
                dryRun: !!dryRun,
                trigger: 'manual-force',
            });

            if (!dryRun && r.deleted > 0) {
                await prisma.adminAction.create({
                    data: {
                        adminId: req.user.id,
                        action: 'notifications_cleanup',
                        payload: JSON.stringify({ days: r.days, deleted: r.deleted }),
                        affected: r.deleted,
                    },
                }).catch(() => {});
            }

            res.json(r);
        } catch (e) {
            console.error('[admin] notify-cleanup-now error:', e);
            res.status(500).json({ error: e.message });
        }
    })
);

export default router;