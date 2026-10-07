import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();

function slugify(title) {
    return (
        String(title || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-zа-я0-9\s-]/gi, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60) +
        '-' +
        Date.now().toString(36).slice(-4)
    );
}

function parseArticle(a) {
    let tags = [];
    try { tags = JSON.parse(a.tags || '[]'); } catch {}
    return { ...a, tags };
}

/* ═══════════ WIKI ═══════════ */
router.get(
    '/wiki/categories',
    safe(async (_req, res) => {
        const cats = await prisma.wikiCategory.findMany({
            orderBy: { order: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
        res.json(cats.map((c) => ({ ...c, articlesCount: c._count.articles })));
    })
);

router.post(
    '/wiki/categories',
    safe(async (req, res) => {
        const { title, description, icon, order, slug } = req.body;
        if (!title) return res.status(400).json({ error: 'Название обязательно' });
        const cat = await prisma.wikiCategory.create({
            data: {
                title,
                slug: slug || slugify(title),
                description: description || null,
                icon: icon || '📄',
                order: Number(order) || 0,
            },
        });
        res.json(cat);
    })
);

router.patch(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'description', 'icon', 'order'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (data.order !== undefined) data.order = Number(data.order) || 0;
        const cat = await prisma.wikiCategory.update({
            where: { id: req.params.id },
            data,
        });
        res.json(cat);
    })
);

router.delete(
    '/wiki/categories/:id',
    safe(async (req, res) => {
        await prisma.wikiCategory.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

router.get(
    '/wiki/articles',
    safe(async (req, res) => {
        const { category, q } = req.query;
        const where = {};
        if (category) {
            const cat = await prisma.wikiCategory.findUnique({ where: { slug: category } });
            if (cat) where.categoryId = cat.id;
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
            ];
        }

        const articles = await prisma.wikiArticle.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(articles.map(parseArticle));
    })
);

router.get(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const a = await prisma.wikiArticle.findUnique({
            where: { id: req.params.id },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!a) return res.status(404).json({ error: 'Статья не найдена' });
        res.json(parseArticle(a));
    })
);

router.post(
    '/wiki/articles',
    safe(async (req, res) => {
        const { title, slug, excerpt, content, cover, categoryId, tags, published } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'title и content обязательны' });
        }
        const article = await prisma.wikiArticle.create({
            data: {
                title,
                slug: slug || slugify(title),
                excerpt: excerpt || null,
                content,
                cover: cover || null,
                categoryId: categoryId || null,
                authorId: req.user.id,
                tags: JSON.stringify(Array.isArray(tags) ? tags : []),
                published: published !== undefined ? !!published : true,
            },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(parseArticle(article));
    })
);

router.patch(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        const allowed = ['title', 'slug', 'excerpt', 'content', 'cover', 'categoryId', 'published'];
        const data = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        if (req.body.tags !== undefined) {
            data.tags = JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags : []);
        }
        if (data.published !== undefined) data.published = !!data.published;

        const article = await prisma.wikiArticle.update({
            where: { id: req.params.id },
            data,
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true } },
            },
        });
        res.json(parseArticle(article));
    })
);

router.delete(
    '/wiki/articles/:id',
    safe(async (req, res) => {
        await prisma.wikiArticle.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);

export default router;