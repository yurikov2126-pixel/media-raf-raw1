import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { auth } from '../middleware/auth.js';
import { extractPeaks, peaksPathFor } from '../lib/audioPeaks.js';

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) =>
        cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
        ),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const router = Router();

// Small cached thumbnails for public chat images. Never access editorial/private uploads.
router.get('/thumb/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}\.(?:jpg|jpeg|png|webp|gif)$/i.test(filename) || filename.includes('..')) {
        return res.status(400).end();
    }
    const original = path.resolve('uploads', filename);
    const thumbsDir = path.resolve('uploads', '.chat-thumbs');
    const thumb = path.join(thumbsDir, filename + '.webp');
    try {
        await fs.stat(original);
        await fs.mkdir(thumbsDir, { recursive: true });
        try {
            await fs.stat(thumb);
        } catch {
            const bytes = await sharp(original).rotate().resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
            await fs.writeFile(thumb, bytes);
        }
        res.type('webp');
        res.set('Cache-Control', 'public, max-age=86400, immutable');
        return res.sendFile(thumb);
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).end();
        console.error('[chat-thumb]', error);
        return res.status(500).end();
    }
});

router.post('/', auth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const fullPath = req.file.path;
    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio = req.file.mimetype.startsWith('audio/');

    try {
        /* ─── Картинки: сжатие + поворот ─── */
        if (isImage) {
            const buf = await fs.readFile(fullPath);
            const out = await sharp(buf)
                .rotate()
                .resize({
                    width: 1920,
                    height: 1920,
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();

            const newPath = fullPath.replace(/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i, '.jpg');
            if (newPath !== fullPath) {
                await fs.unlink(fullPath).catch(() => {});
            }
            await fs.writeFile(newPath, out);
            const filename = path.basename(newPath);
            return res.json({
                url: `/uploads/${filename}`,
                type: 'image/jpeg',
                size: out.length,
            });
        }

        /* ─── Голосовые: генерируем waveform ─── */
        if (isAudio) {
            // Не блокируем ответ на генерацию peaks — она асинхронная
            // и может занять несколько сот мс. Клиент подхватит файл
            // peaks при следующем рендере VoicePlayer.
            (async () => {
                try {
                    const peaks = await extractPeaks(fullPath, 40);
                    if (peaks) {
                        await fs.writeFile(
                            peaksPathFor(fullPath),
                            JSON.stringify(peaks)
                        );
                    }
                } catch (e) {
                    console.error('[uploads] peaks generation failed:', e);
                }
            })();

            return res.json({
                url: `/uploads/${req.file.filename}`,
                type: req.file.mimetype,
                size: req.file.size,
                peaksPending: true,
            });
        }

        /* ─── Остальные файлы ─── */
        res.json({
            url: `/uploads/${req.file.filename}`,
            type: req.file.mimetype,
            size: req.file.size,
        });
    } catch (e) {
        console.error('[uploads] error:', e);
        res.json({
            url: `/uploads/${req.file.filename}`,
            type: req.file.mimetype,
            size: req.file.size,
        });
    }
});

export default router;