import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { zipEntries, streamZip } from '../lib/editorialZip.js';

const router = Router();
const root = path.resolve(process.env.EDITORIAL_LIBRARY_DIR || 'uploads/editorial');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } });
const allowed = user => ['ADMIN', 'MENTOR'].includes(user.role);
const publicFile = file => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, description: file.description, createdAt: file.createdAt });
const archive = (res, files, filename) => {
    if (!files.length) return res.status(404).json({ error: 'Нет доступных файлов' });
    const entries = zipEntries(files.map(file => ({ name: file.name, path: path.join(root, file.storageName), size: file.size })));
    const size = entries.reduce((sum, file) => sum + file.size + 200 + Buffer.byteLength(file.zipName), 0);
    if (size > 0xffffffff || entries.length > 65535) return res.status(413).json({ error: 'Архив слишком большой. Скачайте файлы по отдельности.' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    streamZip(entries).on('error', error => { console.error('[editorial-share] zip failed', error); res.destroy(error); }).pipe(res);
};
const sendFile = (res, next, file, download = false) => {
    const previewSafe = file.mimeType.startsWith('image/') && file.mimeType !== 'image/svg+xml' || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf';
    if (!previewSafe) download = true;
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(path.join(root, file.storageName), error => { if (error && !res.headersSent) next(error); });
};
const getShare = async token => {
    if (!/^[a-f0-9]{48}$/.test(token || '')) return null;
    const share = await prisma.editorialFileShare.findUnique({ where: { token } });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) return null;
    return share;
};
const sharedFiles = async share => prisma.editorialLibraryFile.findMany({ where: { id: { in: Array.isArray(share.fileIds) ? share.fileIds : [] } }, orderBy: { createdAt: 'asc' } });

router.get('/public/:token', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share) return res.status(404).json({ error: 'Ссылка недоступна или срок её действия истёк' });
        const files = await sharedFiles(share);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ share: { title: share.title, description: share.description, createdAt: share.createdAt, expiresAt: share.expiresAt }, files: files.map(publicFile) });
    } catch (error) { next(error); }
});
router.get('/public/:token/archive', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share) return res.status(404).json({ error: 'Ссылка недоступна' });
        res.setHeader('Cache-Control', 'no-store');
        return archive(res, await sharedFiles(share), 'editorial-share.zip');
    } catch (error) { next(error); }
});
router.get('/public/:token/files/:fileId', async (req, res, next) => {
    try {
        const share = await getShare(req.params.token);
        if (!share || !Array.isArray(share.fileIds) || !share.fileIds.includes(req.params.fileId)) return res.status(404).json({ error: 'Файл не найден' });
        const file = await prisma.editorialLibraryFile.findUnique({ where: { id: req.params.fileId } });
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        res.setHeader('Cache-Control', 'no-store');
        sendFile(res, next, file, req.query.download === '1');
    } catch (error) { next(error); }
});

router.use(auth);
router.use((req, res, next) => allowed(req.user) ? next() : res.status(403).json({ error: 'Доступно руководителям редакции' }));
router.get('/files', async (_req, res, next) => {
    try { res.json({ files: (await prisma.editorialLibraryFile.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })).map(publicFile) }); }
    catch (error) { next(error); }
});
router.post('/files', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Выберите файл' });
        const name = path.basename(req.file.originalname.replace(/\\/g, '/')).slice(0, 255);
        const storageName = randomUUID();
        await fs.mkdir(root, { recursive: true, mode: 0o700 });
        await fs.writeFile(path.join(root, storageName), req.file.buffer, { flag: 'wx', mode: 0o600 });
        try {
            const file = await prisma.editorialLibraryFile.create({ data: { name, storageName, mimeType: req.file.mimetype || 'application/octet-stream', size: req.file.size, uploaderId: req.user.id } });
            res.status(201).json({ file: publicFile(file) });
        } catch (error) { await fs.unlink(path.join(root, storageName)).catch(() => {}); throw error; }
    } catch (error) { next(error); }
});
router.delete('/files/:fileId', async (req, res, next) => {
    try {
        const file = await prisma.editorialLibraryFile.findUnique({ where: { id: req.params.fileId } });
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        await prisma.editorialLibraryFile.delete({ where: { id: file.id } });
        await fs.unlink(path.join(root, file.storageName)).catch(error => console.error('[editorial-library] cleanup failed', error));
        res.json({ ok: true });
    } catch (error) { next(error); }
});
router.get('/files/:fileId', async (req, res, next) => {
    try {
        const file = await prisma.editorialLibraryFile.findUnique({ where: { id: req.params.fileId } });
        if (!file) return res.status(404).json({ error: 'Файл не найден' });
        sendFile(res, next, file, req.query.download === '1');
    } catch (error) { next(error); }
});
router.get('/shares', async (_req, res, next) => {
    try { res.json({ shares: await prisma.editorialFileShare.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) }); }
    catch (error) { next(error); }
});
router.post('/shares', async (req, res, next) => {
    try {
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const fileIds = req.body.fileIds;
        if (!title || title.length > 160 || description.length > 2000 || !Array.isArray(fileIds) || !fileIds.length || fileIds.length > 200 || !fileIds.every(id => typeof id === 'string') || new Set(fileIds).size !== fileIds.length) return res.status(400).json({ error: 'Укажите название и выберите файлы' });
        const count = await prisma.editorialLibraryFile.count({ where: { id: { in: fileIds } } });
        if (count !== fileIds.length) return res.status(400).json({ error: 'Некоторые файлы не найдены' });
        const days = req.body.expiresInDays === null ? null : Number(req.body.expiresInDays ?? 30);
        if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) return res.status(400).json({ error: 'Срок действия от 1 до 365 дней' });
        const share = await prisma.editorialFileShare.create({ data: { token: randomBytes(24).toString('hex'), title, description, fileIds, createdById: req.user.id, expiresAt: days === null ? null : new Date(Date.now() + days * 86400000) } });
        res.status(201).json({ share });
    } catch (error) { next(error); }
});
router.post('/shares/:id/revoke', async (req, res, next) => {
    try {
        const result = await prisma.editorialFileShare.updateMany({ where: { id: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
        if (!result.count) return res.status(404).json({ error: 'Ссылка не найдена' });
        res.json({ ok: true });
    } catch (error) { next(error); }
});
export default router;
