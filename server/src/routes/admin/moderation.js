import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
    listReports,
    updateReport,
    deleteReportedContent,
    banReportedUser,
    REPORT_META,
} from '../../lib/moderation.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ МОДЕРАЦИЯ ═══════════ */
router.get(
    '/reports',
    safe(async (req, res) => {
        const { status, targetType, page, limit } = req.query;
        res.json(
            await listReports({
                status: status || undefined,
                targetType: targetType || undefined,
                page: Number(page) || 1,
                limit: Number(limit) || 30,
            })
        );
    })
);

router.get(
    '/reports/meta',
    safe(async (_req, res) => {
        res.json({
            targetTypes: REPORT_META.TARGET_TYPES,
            reasons: REPORT_META.REASONS,
            statuses: REPORT_META.STATUSES,
        });
    })
);

router.patch(
    '/reports/:id',
    safe(async (req, res) => {
        const { status, resolution } = req.body;
        const r = await updateReport({
            id: req.params.id,
            status,
            resolution,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.post(
    '/reports/:id/delete-content',
    safe(async (req, res) => {
        const r = await deleteReportedContent({
            reportId: req.params.id,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.post(
    '/reports/:id/ban-user',
    safe(async (req, res) => {
        const r = await banReportedUser({
            reportId: req.params.id,
            resolverId: req.user.id,
        });
        res.json(r);
    })
);

router.delete(
    '/reports/:id',
    safe(async (req, res) => {
        await prisma.report.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

export default router;