import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { ensureEditorialEquipment } from '../lib/wikiEquipment.js';

const router = Router();
router.use(auth);

function safeJSON(str, fallback = []) {
    try {
        return JSON.parse(str || '[]');
    } catch {
        return fallback;
    }
}

function parseArticle(a) {
    return {
        ...a,
        tags: safeJSON(a.tags, []),
    };
}

/* ─────────── Категории ─────────── */

// Все категории + число опубликованных статей
router.get('/categories', async (_req, res) => {
    try {
        await ensureEditorialEquipment();
        const categories = await prisma.wikiCategory.findMany({
            orderBy: { order: 'asc' },
            include: {
                _count: { select: { articles: { where: { published: true } } } },
            },
        });
        res.json(
            categories.map((c) => ({
                id: c.id,
                slug: c.slug,
                title: c.title,
                description: c.description,
                icon: c.icon,
                order: c.order,
                articlesCount: c._count.articles,
            }))
        );
    } catch (e) {
        console.error('[wiki] categories:', e);
        res.status(500).json({ error: 'Не удалось получить категории' });
    }
});

/* ─────────── Статьи ─────────── */

// Список статей с фильтрами: ?category=slug&q=строка&tag=тег&limit=N
router.get('/articles', async (req, res) => {
    try {
        const { category, q, tag, limit, page } = req.query;
        const where = { published: true };

        if (category) {
            const cat = await prisma.wikiCategory.findUnique({ where: { slug: category } });
            if (!cat) return res.json([]);
            where.categoryId = cat.id;
        }

        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { excerpt: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
            ];
        }

        const paged = page !== undefined;
        const pageNumber = Math.max(1, Math.min(100000, Number(page) || 1));
        const pageSize = Math.max(1, Math.min(60, Number(limit) || 24));
        let articles = await prisma.wikiArticle.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            ...(paged ? { skip: (pageNumber - 1) * pageSize, take: pageSize } : { take: limit ? Math.min(Math.max(Number(limit) || 1, 1), 500) : 500 }),
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
        });

        if (tag) {
            articles = articles.filter((a) => safeJSON(a.tags, []).includes(tag));
        }

        if (paged) {
            const total = await prisma.wikiArticle.count({ where });
            return res.json({ items: articles.map(parseArticle), total, page: pageNumber, pageSize, hasMore: pageNumber * pageSize < total });
        }
        res.json(articles.map(parseArticle));
    } catch (e) {
        console.error('[wiki] articles:', e);
        res.status(500).json({ error: 'Не удалось получить статьи' });
    }
});

// Популярные статьи (топ-5 по просмотрам)
router.get('/popular', async (_req, res) => {
    try {
        const articles = await prisma.wikiArticle.findMany({
            where: { published: true },
            orderBy: { views: 'desc' },
            take: 5,
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
            },
        });
        res.json(articles.map(parseArticle));
    } catch (e) {
        console.error('[wiki] popular:', e);
        res.status(500).json({ error: 'Не удалось получить популярные статьи' });
    }
});

// Случайная опубликованная статья собственной базы знаний для главной страницы.
router.get('/random', async (_req, res) => {
    try {
        const where = { published: true };
        const count = await prisma.wikiArticle.count({ where });
        if (!count) return res.json(null);
        const offset = Math.floor(Math.random() * count);
        const article = await prisma.wikiArticle.findFirst({
            where,
            skip: offset,
            orderBy: { id: 'asc' },
            select: {
                id: true, slug: true, title: true, excerpt: true, cover: true,
                category: { select: { title: true, icon: true } },
            },
        });
        res.set('Cache-Control', 'private, no-store');
        res.json(article);
    } catch (error) {
        console.error('[wiki] random article:', error);
        res.status(500).json({ error: 'Не удалось выбрать статью ВикиМедиа' });
    }
});

// Одна статья + счётчик просмотров + соседние статьи в той же категории
router.get('/articles/:slug', async (req, res) => {
    try {
        const article = await prisma.wikiArticle.findUnique({
            where: { slug: req.params.slug },
            include: {
                category: { select: { id: true, slug: true, title: true, icon: true } },
                author: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
        });

        if (!article || !article.published) {
            return res.status(404).json({ error: 'Статья не найдена' });
        }

        // Увеличиваем просмотры асинхронно — не ждём
        prisma.wikiArticle
            .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
            .catch(() => {});

        // Соседние статьи в той же категории
        let related = [];
        if (article.categoryId) {
            related = await prisma.wikiArticle.findMany({
                where: {
                    published: true,
                    categoryId: article.categoryId,
                    id: { not: article.id },
                },
                take: 4,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, slug: true, title: true, excerpt: true },
            });
        }

        res.json({
            ...parseArticle(article),
            views: article.views + 1,
            related,
        });
    } catch (e) {
        console.error('[wiki] article:', e);
        res.status(500).json({ error: 'Не удалось получить статью' });
    }
});

export default router;