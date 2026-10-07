import { Router } from 'express';
import { safe } from './_shared.js';
import { getAnalytics } from '../../lib/analytics.js';
import { getCourseAnalytics, buildSummary } from '../../lib/courseAnalytics.js';

const router = Router();

/* ═══════════ АНАЛИТИКА ═══════════ */
router.get(
    '/analytics',
    safe(async (req, res) => {
        const period = Math.max(7, Math.min(365, Number(req.query.period) || 30));
        res.json(await getAnalytics(period));
    })
);

/* ─── Воронка по курсам ─── */
router.get(
    '/analytics/courses',
    safe(async (req, res) => {
        const periodRaw = req.query.period;
        let periodDays = null;
        if (periodRaw && periodRaw !== 'all') {
            periodDays = Math.max(7, Math.min(365, Number(periodRaw) || 30));
        }

        const courses = await getCourseAnalytics({ periodDays });
        const summary = buildSummary(courses);

        res.json({
            period: periodDays ?? 'all',
            summary,
            courses,
        });
    })
);

export default router;