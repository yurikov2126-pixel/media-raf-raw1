import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { auth } from '../middleware/auth.js';

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

router.post('/', auth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const fullPath = req.file.path;
    const isImage = req.file.mimetype.startsWith('image/');

    try {
        if (isImage) {
            // Сжимаем: max 1920px по длинной стороне, JPEG q=85
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

            // Меняем расширение на .jpg
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

        // Не image — отдаём как есть
        res.json({
            url: `/uploads/${req.file.filename}`,
            type: req.file.mimetype,
            size: req.file.size,
        });
    } catch (e) {
        console.error('[uploads] sharp error:', e);
        // Если что-то пошло не так — возвращаем исходник
        res.json({
            url: `/uploads/${req.file.filename}`,
            type: req.file.mimetype,
            size: req.file.size,
        });
    }
});

export default router;