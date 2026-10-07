import { Router } from 'express';
import { safe } from './_shared.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

/**
 * Список действий админов с фильтрами и пагинацией.
 * Query:
 *   page, limit       — пагинация (limit ≤ 100)
 *   action            — подстрока в action (contains)
 *   adminId           — конкретный админ
 *   from, to          — ISO-даты, createdAt >= from, <= to
 *   failed            — '1' — только записи с непустым error
 */
router.get(
    '/actions',
    safe(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const where = {};
        if (req.query.action) where.action = { contains: String(req.query.action) };
        if (req.query.adminId) where.adminId = String(req.query.adminId);
        if (req.query.failed === '1') where.error = { not: null };

        if (req.query.from || req.query.to) {
            where.createdAt = {};
            if (req.query.from) {
                const d = new Date(req.query.from);
                if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
            }
            if (req.query.to) {
                const d = new Date(req.query.to);
                if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
            }
        }

        const [total, items] = await Promise.all([
            prisma.adminAction.count({ where }),
            prisma.adminAction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        // Подтягиваем инфо об админах одним запросом.
        // FK у AdminAction.adminId нет, поэтому lookup ручной.
        const adminIds = [...new Set(items.map((i) => i.adminId))];
        const admins = adminIds.length
            ? await prisma.user.findMany({
                where: { id: { in: adminIds } },
                select: { id: true, username: true, fullName: true, avatar: true },
            })
            : [];
        const adminsMap = Object.fromEntries(admins.map((a) => [a.id, a]));

        res.json({
            items: items.map((it) => ({
                ...it,
                payload: (() => {
                    try {
                        return JSON.parse(it.payload || '{}');
                    } catch {
                        return { _raw: it.payload };
                    }
                })(),
                admin: adminsMap[it.adminId] || null,
            })),
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
        });
    })
);

/**
 * Мета-данные для фильтров: список уникальных action'ов и админов,
 * которые вообще что-то делали. Клиент использует для дропдаунов.
 */
router.get(
    '/actions/meta',
    safe(async (_req, res) => {
        const [actionsRaw, adminIdsRaw] = await Promise.all([
            prisma.adminAction.findMany({
                distinct: ['action'],
                select: { action: true },
                orderBy: { action: 'asc' },
            }),
            prisma.adminAction.findMany({
                distinct: ['adminId'],
                select: { adminId: true },
            }),
        ]);

        const adminIds = adminIdsRaw.map((a) => a.adminId);
        const admins = adminIds.length
            ? await prisma.user.findMany({
                where: { id: { in: adminIds } },
                select: { id: true, username: true, fullName: true },
                orderBy: { fullName: 'asc' },
            })
            : [];

        res.json({
            actions: actionsRaw.map((a) => a.action),
            admins,
        });
    })
);

export default router;