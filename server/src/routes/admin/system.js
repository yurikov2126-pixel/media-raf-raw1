import { Router } from 'express';
import { safe } from './_shared.js';
import { getServerInfo, cleanupPm2Logs, cleanupOldBackups } from '../../lib/serverInfo.js';
import {
    scanDatabase,
    cleanupDatabase,
    getDatabaseInfo,
    runVacuumAnalyze,
    deleteOrphanFile,
    purgeOrphanFiles,
} from '../../lib/dbMaintenance.js';
import { checkPgTools } from '../../lib/backup.js';
import { prisma } from '../../lib/prisma.js';

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

/* ─── Точечное удаление осиротевших файлов ─── */

router.delete(
    '/maintenance/orphaned-files/:filename',
    safe(async (req, res) => {
        const t0 = Date.now();
        try {
            const result = await deleteOrphanFile(req.params.filename);
            await prisma.adminAction
                .create({
                    data: {
                        adminId: req.user.id,
                        action: 'maintenance_delete_orphan_file',
                        payload: JSON.stringify({ filename: result.filename }),
                        affected: 1,
                        duration: Date.now() - t0,
                    },
                })
                .catch(() => {});
            res.json(result);
        } catch (e) {
            await prisma.adminAction
                .create({
                    data: {
                        adminId: req.user.id,
                        action: 'maintenance_delete_orphan_file',
                        payload: JSON.stringify({ filename: req.params.filename }),
                        affected: 0,
                        duration: Date.now() - t0,
                        error: e.message,
                    },
                })
                .catch(() => {});
            throw e;
        }
    })
);

router.post(
    '/maintenance/orphaned-files/purge',
    safe(async (req, res) => {
        const { filenames, olderThanDays } = req.body || {};
        const t0 = Date.now();
        try {
            const result = await purgeOrphanFiles({ filenames, olderThanDays });
            await prisma.adminAction
                .create({
                    data: {
                        adminId: req.user.id,
                        action: 'maintenance_purge_orphan_files',
                        payload: JSON.stringify({
                            filenames: filenames || null,
                            olderThanDays: olderThanDays || null,
                            deletedCount: result.deletedCount,
                            failedCount: result.failedCount,
                            freedBytes: result.freedBytes,
                        }),
                        affected: result.deletedCount,
                        duration: Date.now() - t0,
                    },
                })
                .catch(() => {});
            res.json(result);
        } catch (e) {
            await prisma.adminAction
                .create({
                    data: {
                        adminId: req.user.id,
                        action: 'maintenance_purge_orphan_files',
                        payload: JSON.stringify({
                            filenames: filenames || null,
                            olderThanDays: olderThanDays || null,
                        }),
                        affected: 0,
                        duration: Date.now() - t0,
                        error: e.message,
                    },
                })
                .catch(() => {});
            throw e;
        }
    })
);

export default router;