import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
    listBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
} from '../../lib/backup.js';
import { safe } from './_shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// admin/backups.js → routes/admin/ → routes/ → src/ → server/
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKUPS_DIR = path.join(SERVER_ROOT, 'backups');

const router = Router();

/* ═══════════ БЭКАПЫ ═══════════ */
router.get(
    '/backups',
    safe(async (_req, res) => {
        res.json(listBackups());
    })
);

router.post(
    '/backups',
    safe(async (req, res) => {
        const { label, format } = req.body || {};
        const fmt = format === 'plain' ? 'plain' : 'custom';
        const r = await createBackup(label, fmt);
        res.json(r);
    })
);

router.post(
    '/backups/restore',
    safe(async (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'filename обязателен' });

        // Тот же приём, что в download: имя файла без слешей и только
        // с разрешённым расширением. Защита от path traversal.
        const safeName = path.basename(String(filename));
        if (!safeName.endsWith('.dump')) {
            return res.status(400).json({
                error: 'Восстановление возможно только из .dump-файла',
            });
        }

        const src = path.join(BACKUPS_DIR, safeName);
        if (!src.startsWith(BACKUPS_DIR)) {
            return res.status(400).json({ error: 'Неверный путь' });
        }
        if (!fs.existsSync(src)) {
            return res.status(404).json({ error: 'Бэкап не найден' });
        }

        const r = await restoreBackup(safeName);
        res.json({ ...r, message: 'База восстановлена. Перезапустите сервер.' });
    })
);

router.delete(
    '/backups/:filename',
    safe(async (req, res) => {
        // Раньше filename шёл в deleteBackup как есть — path traversal
        // мог вывести за BACKUPS_DIR. Теперь только basename.
        const safeName = path.basename(req.params.filename);
        if (!safeName.endsWith('.dump') && !safeName.endsWith('.sql')) {
            return res.status(400).json({ error: 'Неверное имя файла' });
        }

        deleteBackup(safeName);
        res.json({ ok: true });
    })
);

router.get(
    '/backups/:filename/download',
    safe(async (req, res) => {
        const safeName = path.basename(req.params.filename);
        if (!safeName.endsWith('.dump') && !safeName.endsWith('.sql'))
            return res.status(400).json({ error: 'Неверное имя файла' });

        const file = path.join(BACKUPS_DIR, safeName);
        if (!file.startsWith(BACKUPS_DIR))
            return res.status(400).json({ error: 'Неверный путь' });
        if (!fs.existsSync(file))
            return res.status(404).json({ error: 'Файл не найден' });

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
        fs.createReadStream(file).pipe(res);
    })
);

export default router;