import { Router } from 'express';
import multer from 'multer';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(auth, requireRole('ADMIN'));
const root = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } });
const run = promisify(execFile);
const safe = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const playlistInclude = { items: { orderBy: { position: 'asc' }, include: { asset: { select: { id: true, name: true, durationMs: true } } } } };
const hasAudioHeader = bytes =>
    bytes.subarray(0, 3).toString() === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
    (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE') ||
    bytes.subarray(0, 4).toString() === 'fLaC' ||
    bytes.subarray(0, 4).toString() === 'OggS' ||
    bytes.subarray(4, 8).toString() === 'ftyp';
const validTitle = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 140;
const playlistMs = p => p.items.reduce((sum, item) => sum + item.asset.durationMs, 0);

router.get('/status', (_req, res) => res.json({
    enabled: true, phase: 'PLANNING', playout: 'NOT_CONFIGURED', amplifier: 'NOT_CONNECTED',
}));
router.get('/assets', safe(async (_req, res) => {
    res.json({ assets: await prisma.radioAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }) });
}));
router.post('/assets', upload.single('file'), safe(async (req, res) => {
    const file = req.file;
    if (!file || !file.buffer || !hasAudioHeader(file.buffer))
        return res.status(400).json({ error: 'Требуется поддерживаемый аудиофайл' });
    // Multer/busboy may decode UTF-8 multipart filenames as latin1.
    // Prefer a dedicated UTF-8 field sent by the client; validate and never use it as a disk path.
    const supplied = req.body?.filename;
    const filename = (typeof supplied === 'string' && supplied.trim()
        ? supplied.normalize('NFC')
        : Buffer.from(file.originalname || '', 'latin1').toString('utf8').normalize('NFC')).slice(0, 180);
    if (!filename || !/\.(mp3|wav|ogg|flac|m4a)$/i.test(filename))
        return res.status(400).json({ error: 'Поддерживаются MP3, WAV, OGG, FLAC и M4A' });
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const key = randomUUID() + path.extname(filename).toLowerCase();
    const filePath = path.join(root, key);
    await fs.writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
        // Duration comes from ffprobe, not untrusted client-provided metadata.
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { timeout: 15000 });
        const durationMs = Math.round(Number(stdout.trim()) * 1000);
        if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > 24 * 3600 * 1000)
            return res.status(422).json({ error: 'Не удалось определить длительность' });
        const asset = await prisma.radioAsset.create({ data: {
            name: filename, storageKey: key, mimeType: file.mimetype || 'application/octet-stream',
            byteSize: file.size, durationMs, sha256: createHash('sha256').update(file.buffer).digest('hex'), createdBy: req.user.id,
        } });
        return res.status(201).json({ asset });
    } finally {
        const stored = await prisma.radioAsset.findUnique({ where: { storageKey: key }, select: { id: true } });
        if (!stored) await fs.unlink(filePath).catch(() => {});
    }
}));
router.get('/assets/:id/audio', safe(async (req, res) => {
    const a = await prisma.radioAsset.findUnique({ where: { id: req.params.id } });
    if (!a) return res.status(404).json({ error: 'Запись не найдена' });
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.join(root, path.basename(a.storageKey)));
}));

// Asset metadata may be edited without changing the original audio bytes.
router.patch('/assets/:id', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Укажите название до 140 символов' });
    const updated = await prisma.radioAsset.updateMany({
        where: { id: req.params.id }, data: { name: req.body.name.trim() },
    });
    if (!updated.count) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ asset: await prisma.radioAsset.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/assets/:id', safe(async (req, res) => {
    const asset = await prisma.radioAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'Запись не найдена' });
    const inUse = await prisma.radioPlaylistItem.count({ where: { assetId: asset.id } });
    if (inUse) return res.status(409).json({ error: 'Запись используется в плейлистах. Сначала уберите её оттуда.' });
    await prisma.radioAsset.delete({ where: { id: asset.id } }).catch(e => {
        if (e.code === 'P2003') return null; throw e;
    });
    if (await prisma.radioAsset.findUnique({ where: { id: asset.id } }))
        return res.status(409).json({ error: 'Запись используется в плейлисте' });
    await fs.unlink(path.join(root, path.basename(asset.storageKey))).catch(error => {
        if (error.code !== 'ENOENT') console.error('[radio] orphan file cleanup:', error);
    });
    res.json({ ok: true });
}));


router.get('/folders', safe(async (_req, res) => {
    const folders = await prisma.radioPlaylistFolder.findMany({
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ folders });
}));
router.post('/folders', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Название папки должно содержать от 1 до 140 символов' });
    const folder = await prisma.radioPlaylistFolder.create({ data: { name: req.body.name.trim() } });
    res.status(201).json({ folder });
}));
router.patch('/folders/:id', safe(async (req, res) => {
    if (!validTitle(req.body?.name)) return res.status(400).json({ error: 'Укажите название папки' });
    const result = await prisma.radioPlaylistFolder.updateMany({
        where: { id: req.params.id }, data: { name: req.body.name.trim() },
    });
    if (!result.count) return res.status(404).json({ error: 'Папка не найдена' });
    res.json({ folder: await prisma.radioPlaylistFolder.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/folders/:id', safe(async (req, res) => {
    const result = await prisma.$transaction(async tx => {
        const folder = await tx.radioPlaylistFolder.findUnique({ where: { id: req.params.id } });
        if (!folder) return null;
        await tx.radioPlaylist.updateMany({ where: { folderId: folder.id }, data: { folderId: null } });
        await tx.radioPlaylistFolder.delete({ where: { id: folder.id } });
        return true;
    });
    if (!result) return res.status(404).json({ error: 'Папка не найдена' });
    res.json({ ok: true });
}));
router.patch('/playlists/:id/folder', safe(async (req, res) => {
    const { folderId } = req.body || {};
    if (folderId !== null && (typeof folderId !== 'string' || !folderId.trim()))
        return res.status(400).json({ error: 'Неверная папка' });
    if (folderId && !(await prisma.radioPlaylistFolder.findUnique({ where: { id: folderId } })))
        return res.status(404).json({ error: 'Папка не найдена' });
    const updated = await prisma.radioPlaylist.updateMany({
        where: { id: req.params.id }, data: { folderId },
    });
    if (!updated.count) return res.status(404).json({ error: 'Плейлист не найден' });
    res.json({ playlist: await prisma.radioPlaylist.findUnique({ where: { id: req.params.id } }) });
}));
router.delete('/playlists/:id', safe(async (req, res) => {
    const result = await prisma.$transaction(async tx => {
        // Use the same advisory lock as schedule creation to avoid a race with a new slot.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const playlist = await tx.radioPlaylist.findUnique({ where: { id: req.params.id } });
        if (!playlist) return 'missing';
        const slots = await tx.radioScheduleSlot.count({ where: { playlistId: playlist.id } });
        if (slots) return 'in-use';
        await tx.radioPlaylist.delete({ where: { id: playlist.id } });
        return 'deleted';
    });
    if (result === 'missing') return res.status(404).json({ error: 'Плейлист не найден' });
    if (result === 'in-use') return res.status(409).json({ error: 'Нельзя удалить плейлист, который присутствует в сетке вещания' });
    res.json({ ok: true });
}));

router.get('/playlists', safe(async (_req, res) => {
    res.json({ playlists: await prisma.radioPlaylist.findMany({ include: playlistInclude, orderBy: { updatedAt: 'desc' }, take: 250 }) });
}));
// Always resolve editor state from a unique playlist ID, not a cached list or name.
router.get('/playlists/:id', safe(async (req, res) => {
    const playlist = await prisma.radioPlaylist.findUnique({
        where: { id: req.params.id }, include: playlistInclude,
    });
    if (!playlist) return res.status(404).json({ error: 'Плейлист не найден' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ playlist });
}));
router.post('/playlists', safe(async (req, res) => {
    const { name, description = '', assetIds = [] } = req.body || {};
    if (!validTitle(name) || typeof description !== 'string' || description.length > 2000 ||
        !Array.isArray(assetIds) || assetIds.length > 100 || assetIds.some(id => typeof id !== 'string'))
        return res.status(400).json({ error: 'Неверные данные плейлиста' });
    const unique = [...new Set(assetIds)];
    if (unique.length !== assetIds.length || await prisma.radioAsset.count({ where: { id: { in: unique } } }) !== unique.length)
        return res.status(400).json({ error: 'Одна или несколько записей не найдены' });
    const playlist = await prisma.radioPlaylist.create({ data: {
        name: name.trim(), description: description.trim(), createdBy: req.user.id,
        items: { create: assetIds.map((assetId, position) => ({ assetId, position })) },
    }, include: playlistInclude });
    res.status(201).json({ playlist });
}));
router.put('/playlists/:id', safe(async (req, res) => {
    const { name, description = '', assetIds = [] } = req.body || {};
    if (!validTitle(name) || typeof description !== 'string' || description.length > 2000 ||
        !Array.isArray(assetIds) || assetIds.length > 100 || assetIds.some(id => typeof id !== 'string'))
        return res.status(400).json({ error: 'Неверные данные плейлиста' });
    const unique = [...new Set(assetIds)];
    if (unique.length !== assetIds.length || await prisma.radioAsset.count({ where: { id: { in: unique } } }) !== unique.length)
        return res.status(400).json({ error: 'Записи не найдены или повторяются' });
    const playlist = await prisma.$transaction(async tx => {
        const current = await tx.radioPlaylist.findUnique({ where: { id: req.params.id } });
        if (!current) return null;
        // Existing approved playlists are editable by ADMIN; recalculate all future
        // slot endings atomically and refuse changes that would overlap other shows.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const newAssets = await tx.radioAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, durationMs: true } });
        const lengths = new Map(newAssets.map(a => [a.id, a.durationMs]));
        const durationMs = assetIds.reduce((sum, id) => sum + (lengths.get(id) || 0), 0);
        const future = await tx.radioScheduleSlot.findMany({ where: { playlistId: current.id, startAt: { gt: new Date() } } });
        if (future.length && (!durationMs || durationMs > 12 * 3600000)) return false;
        for (const slot of future) {
            const newEnd = new Date(slot.startAt.getTime() + durationMs);
            const collision = await tx.radioScheduleSlot.findFirst({
                where: { id: { not: slot.id }, startAt: { lt: newEnd }, endAt: { gt: slot.startAt } },
                select: { id: true },
            });
            if (collision) return false;
        }
        await tx.radioPlaylistItem.deleteMany({ where: { playlistId: current.id } });
        const updated = await tx.radioPlaylist.update({ where: { id: current.id }, data: {
            name: name.trim(), description: description.trim(),
            // Preserve approved status and approval attribution; this edit is by ADMIN.
            items: { create: assetIds.map((assetId, position) => ({ assetId, position })) },
        }, include: playlistInclude });
        for (const slot of future) {
            await tx.radioScheduleSlot.update({ where: { id: slot.id }, data: { endAt: new Date(slot.startAt.getTime() + durationMs) } });
        }
        return updated;
    });
    if (playlist === null) return res.status(404).json({ error: 'Плейлист не найден' });
    if (playlist === false) return res.status(409).json({ error: 'Редактирование создаёт конфликт в запланированном эфире. Изменения не сохранены' });
    res.json({ playlist });
}));
router.post('/playlists/:id/approve', safe(async (req, res) => {
    const current = await prisma.radioPlaylist.findUnique({ where: { id: req.params.id }, include: playlistInclude });
    if (!current) return res.status(404).json({ error: 'Плейлист не найден' });
    if (!current.items.length) return res.status(400).json({ error: 'Добавьте записи перед утверждением' });
    const playlist = await prisma.radioPlaylist.update({ where: { id: current.id },
        data: { status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date() }, include: playlistInclude });
    res.json({ playlist });
}));
router.get('/schedule', safe(async (req, res) => {
    const from = new Date(req.query.from), to = new Date(req.query.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to - from > 45 * 86400000)
        return res.status(400).json({ error: 'Неверный диапазон (не более 45 дней)' });
    res.json({ slots: await prisma.radioScheduleSlot.findMany({ where: { startAt: { lt: to }, endAt: { gt: from } },
        include: { playlist: { include: playlistInclude } }, orderBy: { startAt: 'asc' }, take: 500 }) });
}));
router.post('/schedule', safe(async (req, res) => {
    const { playlistId } = req.body || {};
    const startAt = new Date(req.body?.startAt);
    if (!playlistId || !Number.isFinite(startAt.getTime()) || startAt < new Date(Date.now() - 60000))
        return res.status(400).json({ error: 'Укажите утверждённый плейлист и будущее время' });
    const playlist = await prisma.radioPlaylist.findUnique({ where: { id: playlistId }, include: playlistInclude });
    if (!playlist || playlist.status !== 'APPROVED' || !playlist.items.length)
        return res.status(400).json({ error: 'Плейлист не утверждён' });
    const durationMs = playlistMs(playlist);
    if (!durationMs || durationMs > 12 * 3600000) return res.status(400).json({ error: 'Недопустимая продолжительность' });
    const endAt = new Date(startAt.getTime() + durationMs);
    // Serialize scheduling writes to prevent concurrent overlaps.
    const slot = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const clash = await tx.radioScheduleSlot.findFirst({ where: { startAt: { lt: endAt }, endAt: { gt: startAt } } });
        if (clash) return null;
        return tx.radioScheduleSlot.create({ data: { playlistId, startAt, endAt, createdBy: req.user.id } });
    });
    if (!slot) return res.status(409).json({ error: 'Этот интервал уже занят' });
    res.status(201).json({ slot });
}));

router.post('/schedule/weekly', safe(async (req, res) => {
    const { playlistId, weekdays, weeks } = req.body || {};
    const startAt = new Date(req.body?.startAt);
    if (typeof playlistId !== 'string' || !Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now() ||
        !Array.isArray(weekdays) || !weekdays.length || weekdays.length > 7 ||
        weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
        new Set(weekdays).size !== weekdays.length ||
        !Number.isInteger(weeks) || weeks < 1 || weeks > 12)
        return res.status(400).json({ error: 'Укажите будущее время, дни недели и период от 1 до 12 недель' });
    const playlist = await prisma.radioPlaylist.findUnique({ where: { id: playlistId }, include: playlistInclude });
    if (!playlist || playlist.status !== 'APPROVED' || !playlist.items.length)
        return res.status(400).json({ error: 'Плейлист не утверждён' });
    const durationMs = playlistMs(playlist);
    if (!durationMs || durationMs > 12 * 3600000)
        return res.status(400).json({ error: 'Недопустимая продолжительность' });
    // Weekdays follow UTC here. Station timezone support is required before autonomous playout.
    const candidateTimes = [];
    for (let offset = 0; offset < weeks * 7; offset++) {
        const point = new Date(startAt.getTime() + offset * 86400000);
        if (weekdays.includes(point.getUTCDay())) candidateTimes.push(point);
    }
    if (!candidateTimes.length) return res.status(400).json({ error: 'Не найдены подходящие дни' });
    const result = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1729002)`;
        const clash = await tx.radioScheduleSlot.findFirst({ where: { OR: candidateTimes.map(t => ({
            startAt: { lt: new Date(t.getTime() + durationMs) }, endAt: { gt: t },
        })) } });
        if (clash) return null;
        return tx.radioScheduleSlot.createMany({ data: candidateTimes.map(t => ({
            playlistId, startAt: t, endAt: new Date(t.getTime() + durationMs), createdBy: req.user.id,
        })) });
    });
    if (!result) return res.status(409).json({ error: 'Есть пересечение. Повторения не созданы.' });
    res.status(201).json({ created: result.count, timezone: 'UTC' });
}));

router.delete('/schedule/:id', safe(async (req, res) => {
    const result = await prisma.radioScheduleSlot.deleteMany({ where: { id: req.params.id, startAt: { gt: new Date() } } });
    if (!result.count) return res.status(404).json({ error: 'Будущий эфир не найден' });
    res.json({ ok: true });
}));

export default router;
