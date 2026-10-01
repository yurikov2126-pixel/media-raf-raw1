import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';

const router = Router();
const DEFAULT_GROUP_TITLE = 'Команда MEDIA-RAF-RAW';

const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
const publicUser = (u) => { const { passwordHash, ...rest } = u; return rest; };

function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+7' + digits.slice(1);
    if (digits.length === 10) return '+7' + digits;
    return null;
}

async function addToDefaultChat(userId) {
    let chat = await prisma.chat.findFirst({
        where: { type: 'GROUP', title: DEFAULT_GROUP_TITLE },
    });
    if (!chat) {
        chat = await prisma.chat.create({
            data: {
                type: 'GROUP',
                title: DEFAULT_GROUP_TITLE,
                members: { create: [{ userId, role: 'member' }] },
            },
        });
        return chat;
    }
    await prisma.chatMember.upsert({
        where: { chatId_userId: { chatId: chat.id, userId } },
        update: {},
        create: { chatId: chat.id, userId, role: 'member' },
    });
    return chat;
}

router.post('/register', async (req, res) => {
    const { phone, username, firstName, lastName, password, direction } = req.body;

    if (!phone || !username || !firstName || !lastName || !password) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
        return res.status(400).json({ error: 'Некорректный номер телефона' });
    }

    const cleanUsername = String(username).replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        return res.status(400).json({ error: 'Ник: 3–20 символов, латиница/цифры/_' });
    }

    const exists = await prisma.user.findFirst({
        where: { OR: [{ phone: normalized }, { username: cleanUsername }] },
    });
    if (exists) {
        return res.status(409).json({ error: 'Телефон или ник уже заняты' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const user = await prisma.user.create({
        data: {
            phone: normalized,
            username: cleanUsername,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fullName,
            passwordHash: await bcrypt.hash(password, 10),
            role: 'STUDENT',
            direction: direction || null,
        },
    });

    try {
        await addToDefaultChat(user.id);
    } catch (e) {
        console.error('addToDefaultChat failed:', e);
    }

    res.json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(401).json({ error: 'Введите логин и пароль' });

    const normalized = normalizePhone(login);
    const or = [{ username: login }, { email: login }];
    if (normalized) or.push({ phone: normalized });

    const user = await prisma.user.findFirst({ where: { OR: or } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    if (user.isBanned) return res.status(403).json({ error: 'Аккаунт заблокирован' });

    res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json(publicUser(req.user)));

export default router;