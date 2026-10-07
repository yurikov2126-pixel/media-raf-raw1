import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
    listResetRequests,
    getStats as getPasswordResetStats,
    generateCodeForRequest,
    rejectRequest,
} from '../../lib/passwordReset.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ ВОССТАНОВЛЕНИЕ ПАРОЛЯ ═══════════ */

router.get(
    '/password-resets',
    safe(async (req, res) => {
        const { status } = req.query;
        const [items, stats] = await Promise.all([
            listResetRequests({ status: status || undefined }),
            getPasswordResetStats(),
        ]);
        res.json({ items, stats });
    })
);

router.post(
    '/password-resets/:id/generate-code',
    safe(async (req, res) => {
        const { note } = req.body || {};
        try {
            const r = await generateCodeForRequest({
                requestId: req.params.id,
                adminId: req.user.id,
                note,
            });
            await prisma.adminAction.create({
                data: {
                    adminId: req.user.id,
                    action: 'password_reset_generate_code',
                    payload: JSON.stringify({ requestId: req.params.id }),
                    affected: 1,
                },
            }).catch(() => {});
            res.json(r);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

router.post(
    '/password-resets/:id/reject',
    safe(async (req, res) => {
        const { note } = req.body || {};
        try {
            const r = await rejectRequest({
                requestId: req.params.id,
                adminId: req.user.id,
                note,
            });
            await prisma.adminAction.create({
                data: {
                    adminId: req.user.id,
                    action: 'password_reset_reject',
                    payload: JSON.stringify({ requestId: req.params.id }),
                    affected: 1,
                },
            }).catch(() => {});
            res.json(r);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

export default router;