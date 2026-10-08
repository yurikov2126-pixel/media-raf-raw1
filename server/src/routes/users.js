import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const hide = (u) => {
    if (!u) return u;
    const { passwordHash, ...rest } = u;
    return rest;
};

function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+7' + digits.slice(1);
    if (digits.length === 10) return '+7' + digits;
    return null;
}

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Список пользователей
 *     description: |
 *       Возвращает до 60 пользователей. Поддерживает нечёткий поиск
 *       по `fullName`, `username`, `phone` (регистронезависимо) и
 *       фильтр по `direction`.
 *
 *       Забаненные пользователи **не исключаются** — фильтрация на клиенте.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Поисковая строка (ФИО, username или телефон).
 *         example: Иван
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [photo, video, radio, sound]
 *         description: Фильтр по направлению.
 *     responses:
 *       200:
 *         description: Массив пользователей без `passwordHash`
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', auth, async (req, res) => {
    const { q, direction } = req.query;
    const users = await prisma.user.findMany({
        where: {
            AND: [
                q
                    ? {
                        OR: [
                            { fullName: { contains: q, mode: 'insensitive' } },
                            { username: { contains: q, mode: 'insensitive' } },
                            { phone: { contains: q } },
                        ],
                    }
                    : {},
                direction ? { direction } : {},
            ],
        },
        take: 60,
    });
    res.json(users.map(hide));
});

/**
 * @openapi
 * /users/{username}:
 *   get:
 *     tags: [Users]
 *     summary: Профиль пользователя по username
 *     description: |
 *       Возвращает профиль вместе с последними 30 постами, всеми
 *       курсами (enrollments) и выданными сертификатами.
 *
 *       `username` — регистрозависимый, хранится в нижнем регистре.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *         example: test_user
 *     responses:
 *       200:
 *         description: Профиль + посты + курсы + сертификаты
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/User'
 *                 - type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       description: Последние 30 постов (без агрегатов реакций).
 *                       items: { $ref: '#/components/schemas/Post' }
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           progress: { type: integer, example: 40 }
 *                           completed: { type: boolean }
 *                           course:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               slug: { type: string }
 *                               title: { type: string }
 *                     certificates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           serial: { type: string, example: 'MRR-2026-A1B2C3' }
 *                           title: { type: string }
 *                           issuedAt: { type: 'string', format: 'date-time' }
 *                           course:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               slug: { type: string }
 *                               title: { type: string }
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:username', auth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        include: {
            posts: { orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }], take: 30 },
            enrollments: { include: { course: true } },
            certificates: { include: { course: true } },
        },
    });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    res.json(hide(user));
});

// ─── Обновление профиля ─────────────────────────────────────

/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Обновить свой профиль
 *     description: |
 *       Частичное обновление. Любое поле можно не передавать — останется как было.
 *
 *       **Особенности:**
 *       - `firstName` / `lastName` — обновляются вместе с `fullName`.
 *       - `phone` — нормализуется к `+7XXXXXXXXXX`, проверяется уникальность.
 *       - `skills` и `socials` — принимаются как **объекты/массивы**, сохраняются строкой JSON.
 *       - `birthDate` — ISO-строка или `null`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: 'Иван' }
 *               lastName: { type: string, example: 'Тестов' }
 *               phone: { type: string, example: '+79991234567' }
 *               bio: { type: string, nullable: true, example: 'Люблю фотографию' }
 *               avatar: { type: string, nullable: true, example: '/uploads/avatar.jpg' }
 *               cover: { type: string, nullable: true, example: '/uploads/cover.jpg' }
 *               direction:
 *                 type: string
 *                 enum: [photo, video, radio, sound]
 *               skills:
 *                 type: array
 *                 items: { type: string }
 *                 example: ['Photoshop', 'Lightroom']
 *               socials:
 *                 type: object
 *                 example: { vk: 'https://vk.com/...', tg: '@username' }
 *               birthDate: { type: string, format: date, nullable: true, example: '2000-01-15' }
 *               group: { type: string, nullable: true, example: 'ИКБО-01-22' }
 *               city: { type: string, nullable: true, example: 'Москва' }
 *     responses:
 *       200:
 *         description: Обновлённый профиль
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Не хватает имени/фамилии или некорректный телефон
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Телефон занят другим пользователем
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/me', auth, async (req, res) => {
    const {
        firstName,
        lastName,
        phone,
        bio,
        avatar,
        cover,
        direction,
        skills,
        socials,
        birthDate,
        group,
        city,
    } = req.body;

    const data = {};

    if (firstName !== undefined) data.firstName = String(firstName).trim();
    if (lastName !== undefined) data.lastName = String(lastName).trim();

    if (firstName !== undefined || lastName !== undefined) {
        const f = data.firstName ?? req.user.firstName;
        const l = data.lastName ?? req.user.lastName;
        if (!f || !l) return res.status(400).json({ error: 'Имя и фамилия обязательны' });
        data.fullName = `${f} ${l}`.trim();
    }

    if (phone !== undefined) {
        const norm = normalizePhone(phone);
        if (!norm) return res.status(400).json({ error: 'Некорректный телефон' });
        const busy = await prisma.user.findFirst({
            where: { phone: norm, NOT: { id: req.user.id } },
        });
        if (busy) return res.status(409).json({ error: 'Телефон уже используется' });
        data.phone = norm;
    }

    if (bio !== undefined) data.bio = bio;
    if (avatar !== undefined) data.avatar = avatar;
    if (cover !== undefined) data.cover = cover;
    if (direction !== undefined) data.direction = direction;
    if (skills !== undefined) data.skills = JSON.stringify(skills);
    if (socials !== undefined) data.socials = JSON.stringify(socials);
    if (group !== undefined) data.group = group;
    if (city !== undefined) data.city = city;
    if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;

    try {
        const user = await prisma.user.update({ where: { id: req.user.id }, data });
        res.json(hide(user));
    } catch (e) {
        if (e.code === 'P2002') return res.status(409).json({ error: 'Конфликт уникальности' });
        throw e;
    }
});

// ─── Смена своего пароля ────────────────────────────────────
// ВАЖНО: этот маршрут должен идти отдельно, отдельным путём /me/password.

/**
 * @openapi
 * /users/me/password:
 *   patch:
 *     tags: [Users]
 *     summary: Смена своего пароля
 *     description: |
 *       Требует текущий пароль для подтверждения. Обновляет
 *       `passwordChangedAt` — все выданные ранее JWT становятся невалидными,
 *       пользователь перелогинится на всех устройствах.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password, example: 'oldStrongPass123' }
 *               newPassword: { type: string, format: password, example: 'newStrongPass456' }
 *     responses:
 *       200:
 *         description: Пароль изменён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *       400:
 *         description: Не заполнены поля, короткий пароль или новый = текущий
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Неверный текущий пароль или отсутствует токен
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/me/password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'Новый пароль не короче 6 символов' });
        }
        if (currentPassword === newPassword) {
            return res
                .status(400)
                .json({ error: 'Новый пароль должен отличаться от текущего' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Текущий пароль неверный' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                passwordHash,
                passwordChangedAt: new Date(),
            },
        });

        console.log(`[users] password changed for ${user.username}`);
        res.json({ ok: true });
    } catch (e) {
        console.error('[users] password change error:', e);
        res.status(500).json({ error: e.message || 'Не удалось сменить пароль' });
    }
});

/**
 * @openapi
 * /users/me/posts:
 *   post:
 *     tags: [Users]
 *     summary: Создать пост от своего имени
 *     description: |
 *       **Устаревший алиас.** Дублирует `POST /posts` без побочных эффектов
 *       (не рассылает уведомления, не начисляет XP). Оставлен для обратной
 *       совместимости. Для новых интеграций используйте `POST /posts`.
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, example: 'Привет!' }
 *               mediaUrl: { type: string, nullable: true }
 *               mediaType: { type: string, nullable: true, enum: [image, video] }
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
router.post('/me/posts', auth, async (req, res) => {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content?.trim() && !mediaUrl) return res.status(400).json({ error: 'Пустой пост' });
    const post = await prisma.post.create({
        data: { authorId: req.user.id, content: content || '', mediaUrl, mediaType },
    });
    res.json(post);
});

export default router;