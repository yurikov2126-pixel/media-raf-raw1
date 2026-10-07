import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { createResetRequest, verifyCodeAndReset } from '../lib/passwordReset.js';
import { recordDailyActivity } from '../lib/gamification.js';

const router = Router();

/* Обёртка для обработки ошибок в async-роутах.
   Нужна, чтобы не писать try/catch в каждом обработчике. */
const safe = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (e) {
        console.error('[auth] error:', e);
        res.status(500).json({ error: e.message || 'Внутренняя ошибка' });
    }
};

/* ─── Утилиты ─── */

function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+7' + digits.slice(1);
    if (digits.length === 10) return '+7' + digits;
    return null;
}

function signToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET не задан в .env');
    return jwt.sign(
        { id: user.id, role: user.role, username: user.username },
        secret,
        { expiresIn: '30d' }
    );
}

function hidePrivate(user) {
    if (!user) return user;
    const { passwordHash, ...rest } = user;
    return rest;
}

/* ─── Регистрация ─── */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Регистрация нового пользователя
 *     description: |
 *       Создаёт пользователя с ролью `STUDENT`. Телефон нормализуется к виду
 *       `+7XXXXXXXXXX` (принимает `8...`, `7...`, 10 цифр). Username приводится
 *       к нижнему регистру и очищается от `@` в начале.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, phone, username, password]
 *             properties:
 *               firstName: { type: string, example: 'Иван' }
 *               lastName: { type: string, example: 'Тестов' }
 *               phone: { type: string, example: '+79991234567' }
 *               username: { type: string, example: 'test_user' }
 *               password: { type: string, format: password, example: 'strongPass123' }
 *               direction:
 *                 type: string
 *                 enum: [photo, video, radio, sound]
 *                 default: photo
 *                 description: Если невалидное — подставляется `photo`.
 *     responses:
 *       200:
 *         description: Успешная регистрация
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Валидация не пройдена (имя, пароль, телефон, username)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Телефон или username уже заняты
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
    '/register',
    safe(async (req, res) => {
        const { firstName, lastName, phone, username, password, direction } = req.body;

        if (!firstName?.trim() || !lastName?.trim())
            return res.status(400).json({ error: 'Имя и фамилия обязательны' });

        if (!password || String(password).length < 6)
            return res.status(400).json({ error: 'Пароль не короче 6 символов' });

        const normPhone = normalizePhone(phone);
        if (!normPhone)
            return res.status(400).json({ error: 'Некорректный номер телефона' });

        const cleanUsername = String(username || '').trim().replace(/^@/, '').toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername))
            return res.status(400).json({
                error: 'Ник: 3-20 символов, латиница, цифры и _',
            });

        // Проверка занятости
        const busyPhone = await prisma.user.findUnique({ where: { phone: normPhone } });
        if (busyPhone) return res.status(409).json({ error: 'Телефон уже используется' });

        const busyUsername = await prisma.user.findUnique({ where: { username: cleanUsername } });
        if (busyUsername) return res.status(409).json({ error: 'Ник уже занят' });

        const allowedDirections = ['photo', 'video', 'radio', 'sound'];
        const dir = allowedDirections.includes(direction) ? direction : 'photo';

        const passwordHash = await bcrypt.hash(password, 10);
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

        const user = await prisma.user.create({
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                fullName,
                phone: normPhone,
                username: cleanUsername,
                passwordHash,
                direction: dir,
                role: 'STUDENT',
            },
        });

        const token = signToken(user);
        res.json({ token, user: hidePrivate(user) });
    })
);

/* ─── Вход ─── */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Вход по логину и паролю
 *     description: |
 *       `login` — это username (можно с `@`), телефон (в формате `+7...` или `8...`)
 *       или email. Регистронезависим. Возвращает JWT и объект пользователя без `passwordHash`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [login, password]
 *             properties:
 *               login: { type: string, example: 'test_user' }
 *               password: { type: string, format: password, example: 'strongPass123' }
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Не передан `login` или `password`
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Неверный логин или пароль
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Пользователь забанен
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
    '/login',
    safe(async (req, res) => {
        const { login, password } = req.body;
        if (!login?.trim() || !password)
            return res.status(400).json({ error: 'Введите логин и пароль' });

        const raw = String(login).trim().replace(/^@/, '');
        const normPhone = normalizePhone(raw);

        // Ищем по нескольким полям: username, phone, email
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: raw.toLowerCase() },
                    ...(normPhone ? [{ phone: normPhone }] : []),
                    { email: raw.toLowerCase() },
                ],
            },
        });

        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
        if (user.isBanned) return res.status(403).json({ error: 'Аккаунт заблокирован' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });

        // Обновляем lastSeen
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSeen: new Date() },
        }).catch(() => {});

        const token = signToken(user);
        res.json({ token, user: hidePrivate(user) });
    })
);

/* ─── Текущий пользователь ─── */

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Текущий пользователь
 *     description: |
 *       Возвращает профиль по JWT. Обновляет `lastSeen`, а также
 *       регистрирует ежедневный вход для streak (в фоне, не блокирует ответ).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Профиль пользователя
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Токен отсутствует или невалиден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Пользователь забанен
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
    '/me',
    auth,
    safe(async (req, res) => {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.isBanned) return res.status(403).json({ error: 'Аккаунт заблокирован' });

        // Обновляем lastSeen при каждом /me
        prisma.user
            .update({ where: { id: user.id }, data: { lastSeen: new Date() } })
            .catch(() => {});

        // Ежедневный вход + streak
        recordDailyActivity(user.id).catch((e) =>
            console.error('[gamification] daily hook:', e)
        );

        res.json(hidePrivate(user));
    })
);

/* ─── Проверка занятости ника (для формы регистрации) ─── */

/**
 * @openapi
 * /auth/check-username:
 *   get:
 *     tags: [Auth]
 *     summary: Проверка занятости username
 *     security: []
 *     parameters:
 *       - in: query
 *         name: u
 *         required: true
 *         schema: { type: string }
 *         description: Username (можно с `@`, регистр не важен)
 *         example: test_user
 *     responses:
 *       200:
 *         description: |
 *           Всегда 200. Если username занят — `available: false`.
 *           Если формат некорректен — `available: false` и `reason`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available: { type: boolean, example: true }
 *                 reason:
 *                   type: string
 *                   nullable: true
 *                   enum: [too-short, invalid-format]
 *             examples:
 *               free:
 *                 value: { available: true }
 *               busy:
 *                 value: { available: false }
 *               tooShort:
 *                 value: { available: false, reason: too-short }
 *               invalid:
 *                 value: { available: false, reason: invalid-format }
 */
router.get(
    '/check-username',
    safe(async (req, res) => {
        const u = String(req.query.u || '').trim().replace(/^@/, '').toLowerCase();
        if (!u || u.length < 3) return res.json({ available: false, reason: 'too-short' });
        if (!/^[a-z0-9_]{3,20}$/.test(u))
            return res.json({ available: false, reason: 'invalid-format' });

        const busy = await prisma.user.findUnique({ where: { username: u } });
        res.json({ available: !busy });
    })
);

/* ─── Проверка занятости телефона ─── */

/**
 * @openapi
 * /auth/check-phone:
 *   get:
 *     tags: [Auth]
 *     summary: Проверка занятости телефона
 *     security: []
 *     parameters:
 *       - in: query
 *         name: p
 *         required: true
 *         schema: { type: string }
 *         description: Номер в формате +7..., 8... или 10 цифр
 *         example: '+79991234567'
 *     responses:
 *       200:
 *         description: |
 *           Всегда 200. Если номер некорректен — `available: false, reason: invalid`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available: { type: boolean, example: true }
 *                 reason:
 *                   type: string
 *                   nullable: true
 *                   enum: [invalid]
 */
router.get(
    '/check-phone',
    safe(async (req, res) => {
        const norm = normalizePhone(req.query.p);
        if (!norm) return res.json({ available: false, reason: 'invalid' });

        const busy = await prisma.user.findUnique({ where: { phone: norm } });
        res.json({ available: !busy });
    })
);

/* ─── Восстановление пароля ─── */

/**
 * @openapi
 * /auth/recover/request:
 *   post:
 *     tags: [Auth]
 *     summary: Запрос на восстановление пароля
 *     description: |
 *       Создаёт заявку `PasswordResetRequest` со статусом `PENDING`.
 *       Дальше администратор выдаёт код через админку, пользователь вводит
 *       код в `/auth/recover/verify`.
 *
 *       Rate limit: не чаще 5 запросов в сутки (проверяется в `lib/passwordReset`).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Телефон, @username или email
 *                 example: '+79991234567'
 *     responses:
 *       200:
 *         description: Заявка создана
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 requestId: { type: string, example: 'clz9r8y7q0000abcd1234efgh' }
 *                 phoneMasked: { type: string, example: '+7 (999) ***-**-67' }
 *                 username: { type: string, example: 'test_user' }
 *                 fullName: { type: string, example: 'Иван Тестов' }
 *       400:
 *         description: Валидация или rate limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
    '/recover/request',
    safe(async (req, res) => {
        const { identifier } = req.body || {};
        if (!identifier?.trim())
            return res.status(400).json({ error: 'Введите телефон, @ник или email' });

        try {
            const r = await createResetRequest({ identifier: identifier.trim() });
            res.json({
                ok: true,
                requestId: r.requestId,
                phoneMasked: r.phoneMasked,
                username: r.username,
                fullName: r.fullName,
            });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

/**
 * @openapi
 * /auth/recover/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Смена пароля по коду
 *     description: |
 *       Проверяет код, выданный администратором, и меняет пароль.
 *       Обновляет `passwordChangedAt` — все старые JWT становятся невалидными.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, code, newPassword]
 *             properties:
 *               identifier: { type: string, example: '+79991234567' }
 *               code: { type: string, example: '123456' }
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
 *         description: Неверный код, истёк, слишком много попыток или слабый пароль
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
    '/recover/verify',
    safe(async (req, res) => {
        const { identifier, code, newPassword } = req.body || {};
        try {
            const r = await verifyCodeAndReset({ identifier, code, newPassword });
            res.json(r);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

export default router;