import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

// Store previews separately from originals. Reuse cached thumbnails for old files too.
export const thumbnailSupported = mime => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime);

export async function ensureEditorialThumbnail(directory, file) {
    if (!thumbnailSupported(file.mimeType)) return null;
    const destination = path.join(directory, 'thumbnails', file.storageName + '.webp');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
        await fs.access(destination);
        return destination;
    } catch { /* generate missing thumbnail */ }
    const temporary = destination + '.' + randomUUID() + '.tmp';
    try {
        await sharp(path.join(directory, file.storageName), { limitInputPixels: 80_000_000 })
            .rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 72, effort: 3 }).toFile(temporary);
        await fs.rename(temporary, destination);
    } finally {
        await fs.unlink(temporary).catch(() => {});
    }
    return destination;
}

/** Screen-size WebP previews. Originals are never used by image viewers. */
export async function ensureEditorialPreview(directory, file) {
    if (!thumbnailSupported(file.mimeType)) return null;
    const destination = path.join(directory, 'previews', file.storageName + '.webp');
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    try { await fs.access(destination); return destination; } catch { /* generate on demand */ }
    const temporary = destination + '.' + randomUUID() + '.tmp';
    try {
        await sharp(path.join(directory, file.storageName), { limitInputPixels: 80_000_000 })
            .rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 78, effort: 4 }).toFile(temporary);
        await fs.rename(temporary, destination);
    } finally { await fs.unlink(temporary).catch(() => {}); }
    return destination;
}
