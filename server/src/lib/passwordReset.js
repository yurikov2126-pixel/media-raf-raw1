import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

const CODE_TTL_MS = 30 * 60 * 1000;           // 30 минут
const CODE_ATTEMPTS_MAX = 5;
const REQUEST_COOLDOWN_MS = 3 * 60 * 1000;    // между заявками — 3 мин
const MAX_REQUESTS_PER_DAY = 5;

/* ─── Утилиты ─── */

function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+7' + digits.slice(1);
    if (digits.length === 10) return '+7' + digits;
    return null;
}

function generateCode() {
    return String(crypto.randomInt(100000, 999999));
}

function maskPhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length !== 11) return phone;
    return `+${digits[0]} *** ***-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

async function findUserByIdentifier(identifier) {
    const raw = String(identifier || '').trim().replace(/^@/, '');
    if (!raw) return null;
    const phone = normalizePhone(raw);
    return prisma.user.findFirst({
        where: {
            OR: [
                { username: raw.toLowerCase() },
                ...(phone ? [{ phone }] : []),
                { email: raw.toLowerCase() },
            ],
        },
    });
}

/* ─── Создание заявки ─── */

export async function createResetRequest({ identifier }) {
    const user = await findUserByIdentifier(identifier);
    if (!user) throw new Error('Пользователь с такими данными не найден');
    if (user.isBanned) throw new Error('Аккаунт заблокирован');

    // Rate limit — за сутки
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayCount = await prisma.passwordResetRequest.count({
        where: { userId: user.id, createdAt: { gte: dayAgo } },
    });
    if (dayCount >= MAX_REQUESTS_PER_DAY) {
        throw new Error('Слишком много запросов. Попробуйте позже.');
    }

    // Активная заявка
    const active = await prisma.passwordResetRequest.findFirst({
        where: {
            userId: user.id,
            status: { in: ['PENDING', 'CODE_ISSUED'] },
        },
    });
    if (active) {
        const ageMs = Date.now() - active.createdAt.getTime();
        if (ageMs < REQUEST_COOLDOWN_MS) {
            const wait = Math.ceil((REQUEST_COOLDOWN_MS - ageMs) / 1000);
            throw new Error(`Запрос уже отправлен. Подождите ${wait} сек.`);
        }
        await prisma.passwordResetRequest.update({
            where: { id: active.id },
            data: { status: 'EXPIRED' },
        });
    }

    const request = await prisma.passwordResetRequest.create({
        data: { userId: user.id, status: 'PENDING' },
    });

    // Уведомляем админов
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN', isBanned: false },
            select: { id: true },
        });
        for (const a of admins) {
            await createNotification(a.id, 'password_reset', {
                requestId: request.id,
                userId: user.id,
                userName: user.fullName,
                username: user.username,
                phone: user.phone,
                requestedAt: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.error('[passwordReset] notify admins failed:', e);
    }

    return {
        requestId: request.id,
        phoneMasked: maskPhone(user.phone),
        username: user.username,
        fullName: user.fullName,
    };
}

/* ─── Для админки ─── */

export async function listResetRequests({ status } = {}) {
    const where = {};
    if (status) where.status = status;

    return prisma.passwordResetRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    username: true,
                    phone: true,
                    avatar: true,
                    isBanned: true,
                },
            },
        },
    });
}

export async function generateCodeForRequest({ requestId, adminId, note }) {
    const req = await prisma.passwordResetRequest.findUnique({
        where: { id: requestId },
    });
    if (!req) throw new Error('Заявка не найдена');
    if (req.status === 'COMPLETED') throw new Error('Пароль уже изменён');
    if (req.status === 'REJECTED') throw new Error('Заявка отклонена');
    if (req.status === 'EXPIRED') throw new Error('Заявка устарела');

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    const codeExpires = new Date(Date.now() + CODE_TTL_MS);

    await prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: {
            status: 'CODE_ISSUED',
            codeHash,
            codeExpires,
            attempts: 0,
            issuedBy: adminId,
            issuedAt: new Date(),
            note: note || req.note,
        },
    });

    return { code, expiresAt: codeExpires.toISOString() };
}

export async function rejectRequest({ requestId, adminId, note }) {
    await prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: {
            status: 'REJECTED',
            rejectedBy: adminId,
            rejectedAt: new Date(),
            note: note || null,
        },
    });
    return { ok: true };
}

/* ─── Пользовательский ввод кода + новый пароль ─── */

export async function verifyCodeAndReset({ identifier, code, newPassword }) {
    if (!code || String(code).length !== 6)
        throw new Error('Код должен содержать 6 цифр');
    if (!newPassword || String(newPassword).length < 6)
        throw new Error('Пароль не короче 6 символов');

    const user = await findUserByIdentifier(identifier);
    if (!user) throw new Error('Неверный код или пользователь');

    const req = await prisma.passwordResetRequest.findFirst({
        where: {
            userId: user.id,
            status: 'CODE_ISSUED',
            codeExpires: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
    });
    if (!req) throw new Error('Нет активного кода. Запросите восстановление заново.');

    if (req.attempts >= CODE_ATTEMPTS_MAX) {
        await prisma.passwordResetRequest.update({
            where: { id: req.id },
            data: { status: 'EXPIRED' },
        });
        throw new Error('Слишком много попыток. Запросите восстановление заново.');
    }

    const valid = await bcrypt.compare(String(code), req.codeHash);
    if (!valid) {
        await prisma.passwordResetRequest.update({
            where: { id: req.id },
            data: { attempts: req.attempts + 1 },
        });
        const left = CODE_ATTEMPTS_MAX - req.attempts - 1;
        throw new Error(`Неверный код. Осталось попыток: ${left}`);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
        prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                passwordChangedAt: new Date(),
            },
        }),
        prisma.passwordResetRequest.update({
            where: { id: req.id },
            data: {
                status: 'COMPLETED',
                usedAt: new Date(),
                codeHash: null,
                codeExpires: null,
            },
        }),
    ]);

    return { ok: true, username: user.username };
}

/* ─── Статистика для админки ─── */

export async function getStats() {
    const [pending, issued, today, total] = await Promise.all([
        prisma.passwordResetRequest.count({ where: { status: 'PENDING' } }),
        prisma.passwordResetRequest.count({
            where: { status: 'CODE_ISSUED', codeExpires: { gte: new Date() } },
        }),
        prisma.passwordResetRequest.count({
            where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        prisma.passwordResetRequest.count({
            where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }),
    ]);
    return { pending, issued, today, total };
}

/* ─── Очистка старых заявок ─── */

export async function cleanupOldRequests(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const r = await prisma.passwordResetRequest.deleteMany({
        where: {
            createdAt: { lt: cutoff },
            status: { in: ['COMPLETED', 'REJECTED', 'EXPIRED'] },
        },
    });

    // Отдельно: помечаем «зависшие» PENDING-заявки старше 7 дней как EXPIRED
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.passwordResetRequest.updateMany({
        where: {
            status: { in: ['PENDING', 'CODE_ISSUED'] },
            createdAt: { lt: weekAgo },
        },
        data: { status: 'EXPIRED' },
    });

    return { deleted: r.count };
}