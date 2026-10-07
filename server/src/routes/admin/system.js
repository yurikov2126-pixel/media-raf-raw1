import { Router } from 'express';
import { safe } from './_shared.js';
import { getServerInfo, cleanupPm2Logs, cleanupOldBackups } from '../../lib/serverInfo.js';
import {
    scanDatabase,
    cleanupDatabase,
    getDatabaseInfo,
    runVacuumAnalyze,
} from '../../lib/dbMaintenance.js';
import { checkPgTools } from '../../lib/backup.js';

const router = Router();

/* ═══════════ СЕРВЕР ═══════════ */
router.get(
    '/server/info',
    safe(async (_req, res) => {
        res.json(await getServerInfo());
    })
);

router.post(
    '/server/cleanup',
    safe(async (req, res) => {
        const { logs, backups, backupsDays } = req.body || {};
        const result = {};
        if (logs) result.logs = cleanupPm2Logs();
        if (backups) result.backups = cleanupOldBackups(Number(backupsDays) || 30);
        res.json(result);
    })
);

/* ═══════════ ОБСЛУЖИВАНИЕ БД ═══════════ */
router.get(
    '/maintenance/scan',
    safe(async (_req, res) => {
        res.json(await scanDatabase());
    })
);

router.post(
    '/maintenance/cleanup',
    safe(async (_req, res) => {
        res.json(await cleanupDatabase());
    })
);

router.get(
    '/maintenance/dbinfo',
    safe(async (_req, res) => {
        const info = await getDatabaseInfo();
        const tools = checkPgTools();
        res.json({ ...info, tools });
    })
);

router.post(
    '/maintenance/vacuum',
    safe(async (_req, res) => {
        await runVacuumAnalyze();
        res.json({ ok: true, message: 'VACUUM ANALYZE выполнен' });
    })
);

export default router;