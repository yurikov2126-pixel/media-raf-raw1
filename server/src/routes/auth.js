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