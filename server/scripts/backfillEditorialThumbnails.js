import { prisma } from '../src/lib/prisma.js';
import { ensureEditorialThumbnail, thumbnailSupported } from '../src/lib/editorialThumbnails.js';
import path from 'node:path';

const materialRoot = path.resolve(process.env.EDITORIAL_MATERIAL_DIR || 'private/editorial-materials');
const libraryRoot = path.resolve(process.env.EDITORIAL_LIBRARY_DIR || 'uploads/editorial');
const batchSize = 100;
let created = 0, failed = 0, scanned = 0;

async function processModel(model, root, label) {
    let cursor;
    while (true) {
        const files = await model.findMany({
            take: batchSize,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, storageName: true, mimeType: true },
        });
        if (!files.length) break;
        for (const file of files) {
            if (!thumbnailSupported(file.mimeType)) continue;
            scanned++;
            try {
                await ensureEditorialThumbnail(root, file);
                created++;
            } catch (error) {
                failed++;
                console.error(`[backfill] ${label} ${file.id}: ${error.message}`);
            }
        }
        cursor = files[files.length - 1].id;
        console.log(`[backfill] ${label}: scanned ${scanned}, processed ${created}, failed ${failed}`);
    }
}

try {
    await processModel(prisma.editorialMaterialFile, materialRoot, 'materials');
    await processModel(prisma.editorialLibraryFile, libraryRoot, 'library');
    console.log(`[backfill] complete: processed ${created}, failed ${failed}`);
    if (failed) process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
