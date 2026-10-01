import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';

const router = Router();

// ─── Создать пост ──────────────────────────────────────────
router.post('/', auth, async (req, res) => {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content?.trim() && !mediaUrl) {
        return res.status(400).json({ error: 'Пустой пост' });
    }

    const post = await prisma.post.create({
        data: { authorId: req.user.id, content: content || '', mediaUrl, mediaType },
    });

    try {
        const users = await prisma.user.findMany({
            where: { id: { not: req.user.id }, isBanned: false },
            select: { id: true },
        });
        const preview =
            mediaUrl && !content ? '🖼️ Изображение' : (content || '').slice(0, 120);
        for (const u of users) {
            await createNotification(u.id, 'post', {
                postId: post.id,
                authorId: req.user.id,
                authorName: req.user.fullName,
                authorUsername: req.user.username,
                preview,
            });
        }
    } catch (e) {
        console.error('post notify', e);
    }

    res.json(post);
});

// ─── Редактировать пост ────────────────────────────────────
router.patch('/:id', auth, async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    const { content } = req.body;
    const updated = await prisma.post.update({
        where: { id: post.id },
        data: { content: content ?? post.content, editedAt: new Date() },
    });
    res.json(updated);
});

// ─── Удалить пост ──────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ ok: true });
});

// ─── Реакции на пост ──────────────────────────────────────
router.get('/:id/reactions', auth, async (req, res) => {
    const reactions = await prisma.postReaction.findMany({
        where: { postId: req.params.id },
        select: { emoji: true, userId: true },
    });

    // Собираем агрегат: { emoji: { count, users: [...] } }
    const grouped = {};
    for (const r of reactions) {
        if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
        grouped[r.emoji].count++;
        grouped[r.emoji].users.push(r.userId);
    }
    res.json({ reactions: Object.values(grouped), my: reactions.filter((r) => r.userId === req.user.id).map((r) => r.emoji) });
});

router.post('/:id/reactions', auth, async (req, res) => {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji обязателен' });

    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const existing = await prisma.postReaction.findUnique({
        where: {
            postId_userId_emoji: { postId: req.params.id, userId: req.user.id, emoji },
        },
    });

    let action;
    if (existing) {
        await prisma.postReaction.delete({ where: { id: existing.id } });
        action = 'removed';
    } else {
        await prisma.postReaction.create({
            data: { postId: req.params.id, userId: req.user.id, emoji },
        });
        action = 'added';
        if (post.authorId !== req.user.id) {
            await createNotification(post.authorId, 'system', {
                title: 'Новая реакция',
                message: `${req.user.fullName} поставил ${emoji} на ваш пост`,
                postId: post.id,
            });
        }
    }

    const reactions = await prisma.postReaction.findMany({
        where: { postId: req.params.id },
        select: { emoji: true, userId: true },
    });
    const grouped = {};
    for (const r of reactions) {
        if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
        grouped[r.emoji].count++;
        grouped[r.emoji].users.push(r.userId);
    }

    res.json({
        action,
        reactions: Object.values(grouped),
        my: reactions.filter((r) => r.userId === req.user.id).map((r) => r.emoji),
    });
});

// ─── Комментарии к посту ──────────────────────────────────
// Возвращаем дерево (вложенность)
function buildTree(comments) {
    const byId = new Map();
    comments.forEach((c) => byId.set(c.id, { ...c, replies: [] }));
    const roots = [];
    for (const c of byId.values()) {
        if (c.parentId && byId.has(c.parentId)) {
            byId.get(c.parentId).replies.push(c);
        } else {
            roots.push(c);
        }
    }
    // сортировка: сначала старые
    const sortFn = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
    roots.sort(sortFn);
    for (const r of byId.values()) r.replies.sort(sortFn);
    return roots;
}

router.get('/:id/comments', auth, async (req, res) => {
    const comments = await prisma.comment.findMany({
        where: { postId: req.params.id, deletedAt: null },
        include: {
            author: { select: { id: true, fullName: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    res.json(buildTree(comments));
});

router.post('/:id/comments', auth, async (req, res) => {
    const { content, parentId } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Пустой комментарий' });

    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    if (parentId) {
        const parent = await prisma.comment.findUnique({ where: { id: parentId } });
        if (!parent || parent.postId !== post.id) {
            return res.status(400).json({ error: 'Родительский комментарий не найден' });
        }
    }

    const comment = await prisma.comment.create({
        data: {
            postId: req.params.id,
            authorId: req.user.id,
            parentId: parentId || null,
            content: content.trim(),
        },
        include: {
            author: { select: { id: true, fullName: true, username: true, avatar: true } },
        },
    });

    // Уведомление автору поста или родительского комментария
    try {
        if (post.authorId !== req.user.id) {
            await createNotification(post.authorId, 'system', {
                title: 'Новый комментарий',
                message: `${req.user.fullName}: ${content.slice(0, 80)}`,
                postId: post.id,
            });
        }
        if (parentId) {
            const parent = await prisma.comment.findUnique({ where: { id: parentId } });
            if (parent && parent.authorId !== req.user.id && parent.authorId !== post.authorId) {
                await createNotification(parent.authorId, 'system', {
                    title: 'Ответ на ваш комментарий',
                    message: `${req.user.fullName}: ${content.slice(0, 80)}`,
                    postId: post.id,
                });
            }
        }
    } catch (e) {
        console.error('[comments] notify error:', e);
    }

    res.json({ ...comment, replies: [] });
});

router.patch('/comments/:id', auth, async (req, res) => {
    const c = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Комментарий не найден' });
    if (c.authorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    const updated = await prisma.comment.update({
        where: { id: c.id },
        data: { content: req.body.content ?? c.content, editedAt: new Date() },
    });
    res.json(updated);
});

router.delete('/comments/:id', auth, async (req, res) => {
    const c = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Комментарий не найден' });
    if (c.authorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    await prisma.comment.delete({ where: { id: c.id } });
    res.json({ ok: true });
});

export default router;