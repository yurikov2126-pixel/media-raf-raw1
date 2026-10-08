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
const MAX_POST_IMAGES = 10;
function normalizePostImages(mediaUrls, mediaUrl) {
    const urls = Array.isArray(mediaUrls) ? mediaUrls : (mediaUrl ? [mediaUrl] : []);
    if (urls.length > MAX_POST_IMAGES || urls.some((url) => typeof url !== 'string' || !url.trim() || url.length > 2048)) return null;
    return urls.map((url) => url.trim());
}
function postImages(post) {
    if (post.mediaType === 'gallery' && post.mediaUrl) {
        try {
            const urls = JSON.parse(post.mediaUrl);
            if (Array.isArray(urls)) return urls;
        } catch {}
    }
    return post.mediaUrl ? [post.mediaUrl] : [];
}

/* ─────────── Лента (единый запрос + пагинация) ─────────── */
/**
 * @openapi
 * /posts/feed:
 *   get:
 *     tags: [Posts]
 *     summary: Лента постов с cursor-пагинацией
 *     description: |
 *       Возвращает посты в порядке `createdAt DESC, id DESC`.
 *       Посты забаненных авторов исключены.
 *
 *       **Пагинация:** в ответе есть `nextCursor`. Если он не `null` —
 *       передайте его в следующий запрос как `?cursor=<nextCursor>`.
 *       Когда `nextCursor === null`, страницы закончились.
 *
 *       Реакции агрегированы: `reactions[]` — все реакции на пост,
 *       `myReactions[]` — эмодзи текущего пользователя.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Размер страницы (максимум 50).
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: ID последнего поста с предыдущей страницы. Если не указан — начало ленты.
 *     responses:
 *       200:
 *         description: Страница ленты
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PostInFeed' }
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   description: Курсор для следующей страницы или null.
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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
        posts.pop(); // удаляем «лишний», он нужен был только для проверки «есть ещё»
        nextCursor = posts[posts.length - 1].id; // cursor = ID последнего возвращённого
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
            mediaUrl: p.mediaType === 'gallery' ? postImages(p)[0] || null : p.mediaUrl,
            mediaUrls: postImages(p),
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
/**
 * @openapi
 * /posts:
 *   post:
 *     tags: [Posts]
 *     summary: Создать пост
 *     description: |
 *       Создаёт пост. Нужен либо непустой `content`, либо `mediaUrl` —
 *       иначе 400. Файлы сначала загружаются через `POST /uploads`,
 *       а в теле поста передаётся готовый URL.
 *
 *       После создания все активные пользователи (кроме автора) получают
 *       уведомление. Автору начисляется XP (fire-and-forget).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, example: 'Привет, мир!' }
 *               mediaUrl: { type: string, nullable: true, example: '/uploads/abc.jpg' }
 *               mediaType: { type: string, nullable: true, enum: [image, video] }
 *             description: Хотя бы одно из `content` / `mediaUrl` должно быть задано.
 *     responses:
 *       200:
 *         description: Пост создан
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Post' }
 *       400:
 *         description: Пустой пост
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', auth, async (req, res) => {
    const { content, mediaUrl, mediaType, mediaUrls } = req.body;
    const images = normalizePostImages(mediaUrls, mediaUrl);
    if (!images) return res.status(400).json({ error: 'Допускается не более 10 фотографий с корректными адресами' });
    if (!content?.trim() && !images.length) {
        return res.status(400).json({ error: 'Пустой пост' });
    }

    const post = await prisma.post.create({
        data: { authorId: req.user.id, content: content || '', mediaUrl: images.length > 1 ? JSON.stringify(images) : (images[0] || null), mediaType: images.length > 1 ? 'gallery' : (images.length ? 'image' : null) },
    });

    // Уведомления всем (не блокирует)
    try {
        const users = await prisma.user.findMany({
            where: { id: { not: req.user.id }, isBanned: false },
            select: { id: true },
        });
        const preview =
            images.length && !content ? '🖼️ Изображение' : (content || '').slice(0, 120);
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
/**
 * @openapi
 * /posts/{id}:
 *   patch:
 *     tags: [Posts]
 *     summary: Редактировать пост
 *     description: Доступно автору поста или роли `ADMIN`. Проставляет `editedAt`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, example: 'Обновлённый текст' }
 *     responses:
 *       200:
 *         description: Пост обновлён
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Post' }
 *       403:
 *         description: Не автор и не админ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пост не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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
/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     tags: [Posts]
 *     summary: Удалить пост
 *     description: |
 *       Доступно автору или `ADMIN`. Если автор удаляет сам — штраф XP ему,
 *       если админ — штраф уходит автору поста (fire-and-forget).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Пост удалён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *       403:
 *         description: Не автор и не админ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пост не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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
/**
 * @openapi
 * /posts/{id}/reactions:
 *   get:
 *     tags: [Posts]
 *     summary: Агрегированные реакции на пост
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Реакции по эмодзи + список эмодзи текущего пользователя
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AggregatedReactions' }
 */
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

/**
 * @openapi
 * /posts/{id}/reactions:
 *   post:
 *     tags: [Posts]
 *     summary: Поставить / снять реакцию (toggle)
 *     description: |
 *       **Toggle-семантика.** Если реакция с этим эмодзи уже стоит —
 *       она удаляется (`action: "removed"`), иначе создаётся (`action: "added"`).
 *
 *       При добавлении реакции на чужой пост автору поста уходит уведомление.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji: { type: string, example: '❤️' }
 *     responses:
 *       200:
 *         description: Реакция добавлена или удалена; возвращаются обновлённые агрегаты
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/AggregatedReactions'
 *                 - type: object
 *                   properties:
 *                     action: { type: string, enum: [added, removed], example: added }
 *       400:
 *         description: Не передан `emoji`
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пост не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

/**
 * @openapi
 * /posts/{id}/comments:
 *   get:
 *     tags: [Posts]
 *     summary: Дерево комментариев поста
 *     description: |
 *       Возвращает **вложенную** структуру: каждый комментарий содержит
 *       массив `replies` с ответами. Удалённые (`deletedAt !== null`) исключены.
 *       Сортировка — по `createdAt` (ASC) на каждом уровне.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Массив корневых комментариев с вложенными `replies`
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/CommentTree' }
 */
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

/**
 * @openapi
 * /posts/{id}/comments:
 *   post:
 *     tags: [Posts]
 *     summary: Добавить комментарий
 *     description: |
 *       Если передан `parentId` — создаётся ответ на существующий комментарий
 *       того же поста. Иначе — корневой комментарий.
 *
 *       Уведомления: автору поста (если не сам), автору родительского
 *       комментария (если он не автор поста и не сам отвечающий).
 *       Автору начисляется XP (при длине выше `MIN_COMMENT_LENGTH`).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: 'Отличный пост!' }
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: ID родительского комментария (для ответа).
 *     responses:
 *       200:
 *         description: Комментарий создан (пустой `replies` — клиент вставит сам)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CommentTree' }
 *       400:
 *         description: Пустой комментарий или `parentId` не того поста
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пост не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

/**
 * @openapi
 * /posts/comments/{id}:
 *   patch:
 *     tags: [Posts]
 *     summary: Редактировать комментарий
 *     description: Доступно автору комментария или `ADMIN`. Проставляет `editedAt`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, example: 'Уточнённый комментарий' }
 *     responses:
 *       200:
 *         description: Комментарий обновлён
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 *       403:
 *         description: Не автор и не админ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Комментарий не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

/**
 * @openapi
 * /posts/comments/{id}:
 *   delete:
 *     tags: [Posts]
 *     summary: Удалить комментарий
 *     description: |
 *       Доступно автору комментария или `ADMIN`. Если удаляет автор —
 *       штраф XP ему, если админ — штраф уходит автору комментария
 *       (fire-and-forget).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Комментарий удалён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *       403:
 *         description: Не автор и не админ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Комментарий не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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