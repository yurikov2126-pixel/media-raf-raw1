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

router.get('/', auth, async (req, res) => {
    const { q, direction } = req.query;
    const users = await prisma.user.findMany({
        where: {
            AND: [
                q
                    ? {
                        OR: [
                            { fullName: { contains: q } },
                            { username: { contains: q } },
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

router.get('/:username', auth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        include: {
            posts: { orderBy: { createdAt: 'desc' }, take: 30 },
            enrollments: { include: { course: true } },
            certificates: { include: { course: true } },
        },
    });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    res.json(hide(user));
});

// ─── Обновление профиля ─────────────────────────────────────
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
            data: { passwordHash },
        });

        console.log(`[users] password changed for ${user.username}`);
        res.json({ ok: true });
    } catch (e) {
        console.error('[users] password change error:', e);
        res.status(500).json({ error: e.message || 'Не удалось сменить пароль' });
    }
});

router.post('/me/posts', auth, async (req, res) => {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content?.trim() && !mediaUrl) return res.status(400).json({ error: 'Пустой пост' });
    const post = await prisma.post.create({
        data: { authorId: req.user.id, content: content || '', mediaUrl, mediaType },
    });
    res.json(post);
});

export default router;