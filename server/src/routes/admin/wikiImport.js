import { Router } from 'express';
import multer from 'multer';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 45 * 1024 * 1024, files: 1 } });
const DEST = path.resolve('uploads/wiki-assets');
const MAX_FILES = 260;
const MAX_TOTAL = 130 * 1024 * 1024;
const IMAGE_RE = /^assets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp)$/i;
const MARKDOWN_IMAGE_RE = /!\[([^\]\n]*)\]\((assets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp))\)/gi;

function unpackZip(buffer) {
    const entries = new Map();
    let end = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw Object.assign(new Error('Некорректный ZIP-архив'), { status: 400 });
    const count = buffer.readUInt16LE(end + 10);
    const offset = buffer.readUInt32LE(end + 16);
    if (count > MAX_FILES) throw Object.assign(new Error('Слишком много файлов'), { status: 400 });
    let cursor = offset, total = 0;
    for (let i = 0; i < count; i++) {
        if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Повреждён ZIP');
        const method = buffer.readUInt16LE(cursor + 10);
        const flags = buffer.readUInt16LE(cursor + 8);
        const compressed = buffer.readUInt32LE(cursor + 20);
        const size = buffer.readUInt32LE(cursor + 24);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extra = buffer.readUInt16LE(cursor + 30);
        const comment = buffer.readUInt16LE(cursor + 32);
        const local = buffer.readUInt32LE(cursor + 42);
        const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
        cursor += 46 + nameLength + extra + comment;
        if (!name || name.endsWith('/')) continue;
        if (name.startsWith('/') || name.includes('\\') || name.split('/').some(s => !s || s === '..')) throw new Error('Небезопасный путь');
        if ((flags & 1) || ![0, 8].includes(method)) throw new Error('Неподдерживаемый ZIP');
        total += size;
        if (total > MAX_TOTAL) throw new Error('ZIP слишком большой');
        if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Повреждён ZIP');
        const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
        if (start + compressed > buffer.length) throw new Error('Обрезанный ZIP');
        const raw = buffer.subarray(start, start + compressed);
        const data = method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: MAX_TOTAL }) : raw;
        if (data.length !== size || entries.has(name)) throw new Error('Повреждён или повторяется файл ZIP');
        entries.set(name, data);
    }
    return entries;
}
function verifyImage(name, data) {
    if (!IMAGE_RE.test(name) || data.length > 8 * 1024 * 1024) throw new Error('Недопустимое изображение: ' + name);
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const webp = data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!((/\.png$/i.test(name) && png) || (/\.jpe?g$/i.test(name) && jpg) || (/\.webp$/i.test(name) && webp)))
        throw new Error('Неверный формат изображения: ' + name);
}
function parsePackage(buffer) {
    const files = unpackZip(buffer);
    const raw = files.get('manifest.json');
    if (!raw) throw new Error('Не найден manifest.json');
    const manifest = JSON.parse(raw.toString('utf8'));
    if (manifest.type !== 'wiki-import' || manifest.version !== 1) throw new Error('Неподдерживаемый manifest.json');
    if (!Array.isArray(manifest.categories) || !Array.isArray(manifest.articles) ||
        manifest.articles.length < 1 || manifest.articles.length > 100) throw new Error('Некорректный список статей');
    const slugRe = /^[a-z0-9][a-z0-9-]{0,90}$/;
    const categorySlugs = new Set(), articleSlugs = new Set(), assets = new Map(), articles = [];
    for (const category of manifest.categories) {
        if (!slugRe.test(category.slug) || !String(category.title || '').trim() || categorySlugs.has(category.slug))
            throw new Error('Некорректная или повторяющаяся категория');
        categorySlugs.add(category.slug);
    }
    for (const [name, data] of files) {
        if (name === 'manifest.json' || /^articles\/[a-z0-9-]+\.md$/.test(name)) continue;
        verifyImage(name, data);
        assets.set(name, data);
    }
    for (const item of manifest.articles) {
        if (!slugRe.test(item.slug) || !String(item.title || '').trim() ||
            !categorySlugs.has(item.categorySlug) || articleSlugs.has(item.slug) ||
            item.markdown !== 'articles/' + item.slug + '.md') throw new Error('Некорректные данные статьи: ' + item.slug);
        articleSlugs.add(item.slug);
        const markdown = files.get(item.markdown);
        if (!markdown || markdown.length > 500000) throw new Error('Нет Markdown или статья слишком большая: ' + item.slug);
        const content = markdown.toString('utf8');
        if (!content.trim()) throw new Error('Пустая статья: ' + item.slug);
        const references = [...content.matchAll(MARKDOWN_IMAGE_RE)].map(x => x[2]);
        if (item.cover) references.push(item.cover);
        for (const name of references) if (!assets.has(name)) throw new Error('Отсутствует иллюстрация ' + name);
        articles.push({ ...item, content, references });
    }
    return { categories: manifest.categories, articles, assets };
}
const badRequest = (error) => ({ error: error.message || 'Ошибка импорта' });
router.post('/wiki/import/preview', upload.single('archive'), safe(async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Выберите ZIP' });
        const pkg = parsePackage(req.file.buffer);
        const slugs = pkg.articles.map(a => a.slug);
        const existing = await prisma.wikiArticle.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
        const found = new Set(existing.map(a => a.slug));
        res.json({ categories: pkg.categories.length, images: pkg.assets.size,
            articles: pkg.articles.map(a => ({ slug: a.slug, title: a.title, images: a.references.length, action: found.has(a.slug) ? 'update' : 'create' })) });
    } catch (e) { res.status(400).json(badRequest(e)); }
}));
router.post('/wiki/import', upload.single('archive'), safe(async (req, res) => {
    if (!['create', 'replace'].includes(req.body.mode)) return res.status(400).json({ error: 'Выберите режим импорта' });
    let pkg;
    try { pkg = parsePackage(req.file?.buffer || Buffer.alloc(0)); }
    catch (e) { return res.status(400).json(badRequest(e)); }
    await fs.mkdir(DEST, { recursive: true });
    const saved = [];
    try {
        const urls = new Map();
        for (const [name, data] of pkg.assets) {
            const filename = randomUUID() + path.extname(name).toLowerCase();
            await fs.writeFile(path.join(DEST, filename), data, { flag: 'wx' });
            saved.push(filename);
            urls.set(name, '/uploads/wiki-assets/' + filename);
        }
        const result = await prisma.$transaction(async tx => {
            const categoryMap = new Map();
            for (const cat of pkg.categories) {
                const record = await tx.wikiCategory.upsert({ where: { slug: cat.slug }, update: {},
                    create: { slug: cat.slug, title: cat.title, description: cat.description || null, icon: cat.icon || '📄', order: Number(cat.order) || 0 } });
                categoryMap.set(cat.slug, record.id);
            }
            let created = 0, updated = 0, skipped = 0;
            for (const item of pkg.articles) {
                const existing = await tx.wikiArticle.findUnique({ where: { slug: item.slug } });
                if (existing && req.body.mode === 'create') { skipped++; continue; }
                const content = item.content.replace(MARKDOWN_IMAGE_RE, (_all, alt, name) => '![' + alt + '](' + urls.get(name) + ')');
                const data = { title: item.title, excerpt: item.excerpt || null, content, cover: item.cover ? urls.get(item.cover) : null,
                    tags: JSON.stringify(Array.isArray(item.tags) ? item.tags : []), categoryId: categoryMap.get(item.categorySlug),
                    published: existing ? existing.published : item.published === true };
                if (existing) { await tx.wikiArticle.update({ where: { slug: item.slug }, data }); updated++; }
                else { await tx.wikiArticle.create({ data: { ...data, slug: item.slug, authorId: req.user.id } }); created++; }
            }
            return { created, updated, skipped };
        });
        res.json({ ok: true, ...result, images: saved.length });
    } catch (e) {
        await Promise.all(saved.map(name => fs.unlink(path.join(DEST, name)).catch(() => {})));
        throw e;
    }
}));
export default router;
