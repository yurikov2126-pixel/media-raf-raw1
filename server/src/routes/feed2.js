import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);
const authorSelect = { id: true, fullName: true, username: true, avatar: true, direction: true };
const postInclude = (userId) => ({
    author: { select: authorSelect },
    reactions: { select: { emoji: true, userId: true } },
    _count: { select: { comments: true, savedBy: true, reposts: true } },
    savedBy: { where: { userId }, select: { userId: true } },
    repostOf: { select: { id: true, content: true, mediaUrl: true, mediaType: true, createdAt: true, author: { select: authorSelect } } },
});
function images(post) {
    if (post.mediaType === 'gallery' && post.mediaUrl) {
        try { const arr = JSON.parse(post.mediaUrl); return Array.isArray(arr) ? arr : []; } catch { return []; }
    }
    return post.mediaUrl ? [post.mediaUrl] : [];
}
function serialize(p, myId) {
    const reactions = new Map();
    for (const r of p.reactions) {
        if (!reactions.has(r.emoji)) reactions.set(r.emoji, { emoji: r.emoji, count: 0, users: [] });
        const item = reactions.get(r.emoji); item.count++; item.users.push(r.userId);
    }
    const original = p.repostOf;
    return {
        id: p.id, content: p.content, createdAt: p.createdAt, editedAt: p.editedAt, pinnedAt: p.pinnedAt,
        author: p.author, mediaType: p.mediaType, mediaUrls: images(p), mediaUrl: images(p)[0] || null,
        reactions: [...reactions.values()], myReactions: p.reactions.filter((r) => r.userId === myId).map((r) => r.emoji),
        _count: p._count, isSaved: p.savedBy.some((s) => s.userId === myId),
        repostOf: original ? { ...original, mediaUrls: images(original), mediaUrl: images(original)[0] || null } : null,
    };
}
const HASHTAG = /^[\p{L}\p{N}_]{1,50}$/u;
router.get('/posts', async (req, res) => {
    const mode = ['latest', 'recommended', 'saved'].includes(req.query.mode) ? req.query.mode : 'latest';
    const page = Math.max(0, Math.min(10000, Number.parseInt(req.query.page, 10) || 0));
    const limit = Math.max(1, Math.min(30, Number.parseInt(req.query.limit, 10) || 20));
    const q = String(req.query.q || '').trim().slice(0, 100);
    const tag = String(req.query.tag || '').replace(/^#/, '').trim().slice(0, 50);
    if (tag && !HASHTAG.test(tag)) return res.status(400).json({ error: 'Некорректный хештег' });
    const author = String(req.query.author || '').trim().replace(/^@/, '').slice(0, 60);
    const period = ['all', '7d', '30d', '90d'].includes(req.query.period) ? req.query.period : 'all';
    const sort = ['newest', 'oldest', 'popular'].includes(req.query.sort) ? req.query.sort : 'newest';
    const where = { author: { isBanned: false } };
    if (author) where.author = { isBanned: false, username: { equals: author, mode: 'insensitive' } };
    if (period !== 'all') {
        const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
        where.createdAt = { gte: new Date(Date.now() - days * 86400000) };
    }
    if (q) where.OR = [{ content: { contains: q, mode: 'insensitive' } }, { author: { fullName: { contains: q, mode: 'insensitive' }, isBanned: false } }, { author: { username: { contains: q, mode: 'insensitive' }, isBanned: false } }];
    if (tag) where.content = { contains: '#' + tag, mode: 'insensitive' };
    if (mode === 'saved') where.savedBy = { some: { userId: req.user.id } };
    // For recommended posts use a recent window and rank by engagement, with a recency boost.
    if (mode === 'recommended') {
        const recent = await prisma.post.findMany({ where: { ...where, createdAt: { gte: new Date(Math.max(Date.now() - 30 * 86400000, where.createdAt?.gte?.getTime() || 0)) } }, orderBy: { createdAt: 'desc' }, take: 300, include: postInclude(req.user.id) });
        const now = Date.now();
        const viewer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { direction: true } });
        const ranked = recent.map((p) => ({ p, score: p.reactions.length * 2 + p._count.comments * 3 + p._count.savedBy * 2 + p._count.reposts * 4 + (viewer?.direction && p.author.direction === viewer.direction ? 5 : 0) + Math.max(0, 14 - (now - new Date(p.createdAt).getTime()) / 86400000) }));
        ranked.sort((a, b) => b.score - a.score || new Date(b.p.createdAt) - new Date(a.p.createdAt) || a.p.id.localeCompare(b.p.id));
        const items = ranked.slice(page * limit, (page + 1) * limit).map(({ p }) => serialize(p, req.user.id));
        return res.json({ items, nextPage: (page + 1) * limit < ranked.length ? page + 1 : null, total: ranked.length });
    }
    const orderBy = sort === 'oldest'
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : sort === 'popular'
            ? [{ reactions: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
            : [{ createdAt: 'desc' }, { id: 'desc' }];
    const posts = await prisma.post.findMany({ where, orderBy, skip: page * limit, take: limit + 1, include: postInclude(req.user.id) });
    const hasMore = posts.length > limit;
    res.json({ items: posts.slice(0, limit).map((p) => serialize(p, req.user.id)), nextPage: hasMore ? page + 1 : null });
});
router.put('/posts/:id/save', async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, author: { select: { isBanned: true } } } });
    if (!post || post.author.isBanned) return res.status(404).json({ error: 'Публикация не найдена' });
    await prisma.savedPost.upsert({ where: { userId_postId: { userId: req.user.id, postId: post.id } }, create: { userId: req.user.id, postId: post.id }, update: {} });
    res.json({ saved: true });
});
router.delete('/posts/:id/save', async (req, res) => {
    await prisma.savedPost.deleteMany({ where: { userId: req.user.id, postId: req.params.id } });
    res.json({ saved: false });
});
router.post('/posts/:id/repost', async (req, res) => {
    const original = await prisma.post.findUnique({ where: { id: req.params.id }, include: { author: { select: { isBanned: true } } } });
    if (!original || original.author.isBanned) return res.status(404).json({ error: 'Публикация не найдена' });
    const rootId = original.repostOfId || original.id;
    const root = await prisma.post.findUnique({ where: { id: rootId }, include: { author: { select: { isBanned: true } } } });
    if (!root || root.author.isBanned) return res.status(404).json({ error: 'Оригинал недоступен' });
    const content = String(req.body?.content || '').trim();
    if (content.length > 1000) return res.status(400).json({ error: 'Комментарий к репосту слишком длинный' });
    const post = await prisma.post.create({ data: { authorId: req.user.id, content, repostOfId: rootId } });
    res.status(201).json({ id: post.id });
});
router.get('/tags', async (req, res) => {
    const posts = await prisma.post.findMany({ where: { author: { isBanned: false }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { content: true }, orderBy: { createdAt: 'desc' }, take: 500 });
    const counts = new Map();
    for (const post of posts) for (const match of post.content.matchAll(/(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50})/gu)) {
        const tag = match[2].toLowerCase(); counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    res.json([...counts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count })));
});
export default router;
