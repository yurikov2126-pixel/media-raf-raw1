import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getServerInfo } from '../../lib/serverInfo.js';
import { safe } from './_shared.js';

const router = Router();

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function dayRange(days) {
    const out = [];
    const today = startOfDay(new Date());
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        out.push(d);
    }
    return out;
}

function fmtKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function getRegistrationsByDay(days) {
    const range = dayRange(days);
    const start = range[0];
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
    });

    const buckets = range.map((d) => ({
        date: fmtKey(d),
        label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        value: 0,
    }));
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    for (const u of users) {
        const k = fmtKey(startOfDay(u.createdAt));
        if (idx.has(k)) buckets[idx.get(k)].value++;
    }
    return buckets;
}

async function getActivityByDay(days) {
    const range = dayRange(days);
    const start = range[0];
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [messages, comments, posts] = await Promise.all([
        prisma.message.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
        prisma.comment.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
        prisma.post.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
    ]);

    const buckets = range.map((d) => ({
        date: fmtKey(d),
        label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        messages: 0,
        comments: 0,
        posts: 0,
        total: 0,
    }));
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    const bump = (date, key) => {
        const k = fmtKey(startOfDay(date));
        const i = idx.get(k);
        if (i === undefined) return;
        buckets[i][key]++;
        buckets[i].total++;
    };
    messages.forEach((m) => bump(m.createdAt, 'messages'));
    comments.forEach((c) => bump(c.createdAt, 'comments'));
    posts.forEach((p) => bump(p.createdAt, 'posts'));
    return buckets;
}

async function getRecentActions(limit = 10) {
    const items = await prisma.adminAction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    const adminIds = [...new Set(items.map((i) => i.adminId))];
    const admins = adminIds.length
        ? await prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, username: true, fullName: true, avatar: true },
        })
        : [];
    const map = Object.fromEntries(admins.map((a) => [a.id, a]));
    return items.map((it) => ({
        id: it.id,
        action: it.action,
        affected: it.affected,
        error: it.error,
        createdAt: it.createdAt,
        admin: map[it.adminId] || null,
    }));
}

async function getHealth() {
    const info = await getServerInfo();
    const warnings = [];
    if (info.cpu?.usage > 85) {
        warnings.push({
            kind: 'cpu',
            value: info.cpu.usage,
            message: `CPU загружен на ${info.cpu.usage}%`,
        });
    }
    if (info.memory?.usage > 90) {
        warnings.push({
            kind: 'ram',
            value: info.memory.usage,
            message: `RAM занята на ${info.memory.usage}%`,
        });
    }
    if (info.disk?.usage > 90) {
        warnings.push({
            kind: 'disk',
            value: info.disk.usage,
            message: `Диск занят на ${info.disk.usage}%`,
        });
    }
    return {
        cpu: info.cpu || null,
        memory: info.memory || null,
        disk: info.disk || null,
        warnings,
    };
}

/**
 * Сводка для дашборда-2.0.
 * Query:
 *   period — 7 или 30 дней (по умолчанию 7)
 *
 * Счётчики (users/courses/…) НЕ дублируем — они уже в /admin/stats.
 * Dashboard принимает их пропсом, чтобы не делать два запроса.
 */
router.get(
    '/dashboard/summary',
    safe(async (req, res) => {
        const period = Math.min(90, Math.max(7, Number(req.query.period) || 7));

        const [registrations, activity, recentActions, health] = await Promise.all([
            getRegistrationsByDay(period),
            getActivityByDay(period),
            getRecentActions(10),
            getHealth(),
        ]);

        res.json({ period, registrations, activity, recentActions, health });
    })
);

export default router;