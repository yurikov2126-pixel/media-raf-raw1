import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';
import {
    onPostCreated,
    onCommentCreated,
    onPostDeleted,
    onCommentDeleted,
    onReactionGiven,
} from '../lib/gamification.js';

const router = Router();

/* ─────────── Лента (единый запрос + пагинация) ─────────── */
router.get('/feed', auth, async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const cursor = req.query.cursor || null;

    const posts = await prisma.post.findMany({
        where: {
            author: { isBanned: false },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
            author: {
                select: {
                    id: true,
                    fullName: true,
                    username: true,
                    avatar: true,
                    direction: true,
                },
            },
            reactions: { select: { emoji: true, userId: true } },
            _count: { select: { comments: true } },
        },
    });

    let nextCursor = null;
    if (posts.length > limit) {
        const extra = posts.pop();
        nextCursor = extra.id;
    }

    const myId = req.user.id;
    const items = posts.map((p) => {
        const grouped = {};
        for (const r of p.reactions) {
            if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
            grouped[r.emoji].count++;
            grouped[r.emoji].users.push(r.userId);
        }
        const myReactions = p.reactions
            .filter((r) => r.userId === myId)
            .map((r) => r.emoji);

        return {
            id: p.id,
            content: p.content,
            mediaUrl: p.mediaUrl,
            mediaType: p.mediaType,
            createdAt: p.createdAt,
            editedAt: p.editedAt,
            author: p.author,
            reactions: Object.values(grouped),
            myReactions,
            _count: { comments: p._count.comments },
        };
    });

    res.json({ items, nextCursor });
});

/* ─────────── Создать пост ─────────── */
router.post('/', auth, async (req, res) => {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content?.trim() && !mediaUrl) {
        return res.status(400).json({ error: 'Пустой пост' });
    }

    const post = await prisma.post.create({
        data: { authorId: req.user.id, content: content || '', mediaUrl, mediaType },
    });

    // Уведомления всем (не блокирует)
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

    // ─── Геймификация: XP за пост + прогресс квеста ───
    onPostCreated(req.user.id).catch((e) =>
        console.error('[posts] gamif post:', e)
    );

    res.json(post);
});

/* ─────────── Редактировать пост ─────────── */
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

/* ─────────── Удалить пост ─────────── */
router.delete('/:id', auth, async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Нет прав' });
    }

    await prisma.post.delete({ where: { id: post.id } });

    // ─── Геймификация: вычет XP за удаление ───
    // Если автор удаляет сам — штраф ему. Если админ удаляет чужой — штраф автору.
    if (post.authorId === req.user.id) {
        onPostDeleted(req.user.id, post.id).catch((e) =>
            console.error('[posts] gamif post delete:', e)
        );
    } else if (req.user.role === 'ADMIN') {
        onPostDeleted(post.authorId, post.id).catch((e) =>
            console.error('[posts] gamif admin-delete:', e)
        );
    }

    res.json({ ok: true });
});

/* ─────────── Реакции на пост ─────────── */
router.get('/:id/reactions', auth, async (req, res) => {
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
        reactions: Object.values(grouped),
        my: reactions.filter((r) => r.userId === req.user.id).map((r) => r.emoji),
    });
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

        // ─── Геймификация: прогресс квеста «поставь реакции» ───
        onReactionGiven(req.user.id).catch((e) =>
            console.error('[posts] gamif reaction:', e)
        );
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

/* ─────────── Комментарии к посту ─────────── */
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

    // ─── Геймификация: XP за комментарий (мин. длина) + прогресс квеста ───
    onCommentCreated(req.user.id, content).catch((e) =>
        console.error('[posts] gamif comment:', e)
    );

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

    // ─── Геймификация: вычет XP за удаление комментария ───
    if (c.authorId === req.user.id) {
        onCommentDeleted(req.user.id, c.id).catch((e) =>
            console.error('[posts] gamif comment delete:', e)
        );
    } else if (req.user.role === 'ADMIN') {
        onCommentDeleted(c.authorId, c.id).catch((e) =>
            console.error('[posts] gamif admin-comment delete:', e)
        );
    }

    res.json({ ok: true });
});

export default router;