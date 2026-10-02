import { prisma } from './prisma.js';

const TARGET_TYPES = ['post', 'comment', 'message', 'user'];
const REASONS = ['spam', 'abuse', 'illegal', 'other'];
const STATUSES = ['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

/* Проверяем, что цель существует. Возвращает объект или null. */
async function resolveTarget(targetType, targetId) {
    switch (targetType) {
        case 'post':
            return prisma.post.findUnique({
                where: { id: targetId },
                include: { author: { select: { id: true, fullName: true, username: true, avatar: true } } },
            });
        case 'comment':
            return prisma.comment.findUnique({
                where: { id: targetId },
                include: { author: { select: { id: true, fullName: true, username: true, avatar: true } } },
            });
        case 'message':
            return prisma.message.findUnique({
                where: { id: targetId },
                include: { sender: { select: { id: true, fullName: true, username: true, avatar: true } } },
            });
        case 'user':
            return prisma.user.findUnique({
                where: { id: targetId },
                select: { id: true, fullName: true, username: true, avatar: true, isBanned: true, role: true },
            });
        default:
            return null;
    }
}

/* Создание жалобы. */
export async function createReport({ reporterId, targetType, targetId, reason, comment }) {
    if (!TARGET_TYPES.includes(targetType)) {
        throw new Error('Недопустимый тип объекта');
    }
    if (!REASONS.includes(reason)) {
        throw new Error('Недопустимая причина');
    }
    const target = await resolveTarget(targetType, targetId);
    if (!target) throw new Error('Объект не найден');

    // Запрет на жалобу самого на себя
    const targetOwnerId =
        targetType === 'message' ? target.senderId : targetType === 'user' ? target.id : target.authorId;
    if (targetOwnerId === reporterId) {
        throw new Error('Нельзя жаловаться на собственный контент');
    }

    // Защита от дублей: одна жалоба на объект от пользователя за 24 часа
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await prisma.report.findFirst({
        where: { reporterId, targetType, targetId, createdAt: { gte: since } },
    });
    if (dup) throw new Error('Вы уже жаловались на это недавно');

    return prisma.report.create({
        data: { reporterId, targetType, targetId, reason, comment: comment || null },
    });
}

/* Список жалоб с фильтрами. */
export async function listReports({ status, targetType, page = 1, limit = 30 }) {
    const where = {};
    if (status && STATUSES.includes(status)) where.status = status;
    if (targetType && TARGET_TYPES.includes(targetType)) where.targetType = targetType;

    const [items, total] = await Promise.all([
        prisma.report.findMany({
            where,
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            take: Math.min(100, limit),
            skip: (Math.max(1, page) - 1) * limit,
            include: {
                reporter: { select: { id: true, fullName: true, username: true, avatar: true } },
                resolver: { select: { id: true, fullName: true, username: true } },
            },
        }),
        prisma.report.count({ where }),
    ]);

    // Подтягиваем объекты жалоб одним пакетом
    const byType = { post: [], comment: [], message: [], user: [] };
    for (const r of items) {
        if (byType[r.targetType]) byType[r.targetType].push(r.targetId);
    }

    const [posts, comments, messages, users] = await Promise.all([
        byType.post.length
            ? prisma.post.findMany({
                where: { id: { in: byType.post } },
                include: { author: { select: { id: true, fullName: true, username: true, avatar: true } } },
            })
            : [],
        byType.comment.length
            ? prisma.comment.findMany({
                where: { id: { in: byType.comment } },
                include: { author: { select: { id: true, fullName: true, username: true, avatar: true } } },
            })
            : [],
        byType.message.length
            ? prisma.message.findMany({
                where: { id: { in: byType.message } },
                include: { sender: { select: { id: true, fullName: true, username: true, avatar: true } } },
            })
            : [],
        byType.user.length
            ? prisma.user.findMany({
                where: { id: { in: byType.user } },
                select: { id: true, fullName: true, username: true, avatar: true, isBanned: true },
            })
            : [],
    ]);

    const targetsMap = new Map();
    for (const p of posts) targetsMap.set(`post:${p.id}`, { type: 'post', data: p });
    for (const c of comments) targetsMap.set(`comment:${c.id}`, { type: 'comment', data: c });
    for (const m of messages) targetsMap.set(`message:${m.id}`, { type: 'message', data: m });
    for (const u of users) targetsMap.set(`user:${u.id}`, { type: 'user', data: u });

    const enriched = items.map((r) => ({
        ...r,
        target: targetsMap.get(`${r.targetType}:${r.targetId}`) || null,
    }));

    return { items: enriched, total, page, limit, pages: Math.ceil(total / limit) };
}

/* Обновление статуса жалобы. */
export async function updateReport({ id, status, resolution, resolverId }) {
    if (!STATUSES.includes(status)) throw new Error('Недопустимый статус');
    const data = {
        status,
        resolution: resolution || null,
    };
    if (status === 'RESOLVED' || status === 'REJECTED') {
        data.resolvedBy = resolverId;
        data.resolvedAt = new Date();
    }
    return prisma.report.update({ where: { id }, data });
}

/* Удаление объекта жалобы + закрытие всех связанных жалоб. */
export async function deleteReportedContent({ reportId, resolverId }) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Жалоба не найдена');

    await prisma.$transaction(async (tx) => {
        switch (report.targetType) {
            case 'post':
                await tx.post.delete({ where: { id: report.targetId } }).catch(() => {});
                break;
            case 'comment':
                await tx.comment.delete({ where: { id: report.targetId } }).catch(() => {});
                break;
            case 'message':
                await tx.message.update({
                    where: { id: report.targetId },
                    data: { deletedAt: new Date(), content: '' },
                }).catch(() => {});
                break;
            case 'user':
                await tx.user.update({
                    where: { id: report.targetId },
                    data: { isBanned: true },
                }).catch(() => {});
                break;
        }

        // Закрываем все открытые жалобы на этот же объект
        await tx.report.updateMany({
            where: {
                targetType: report.targetType,
                targetId: report.targetId,
                status: { in: ['NEW', 'IN_REVIEW'] },
            },
            data: {
                status: 'RESOLVED',
                resolution: 'Контент удалён / пользователь заблокирован',
                resolvedBy: resolverId,
                resolvedAt: new Date(),
            },
        });
    });

    return { ok: true };
}

/* Бан автора контента. */
export async function banReportedUser({ reportId, resolverId }) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Жалоба не найдена');

    const target = await resolveTarget(report.targetType, report.targetId);
    if (!target) throw new Error('Объект не найден');

    const userId =
        report.targetType === 'message' ? target.senderId : report.targetType === 'user' ? target.id : target.authorId;
    if (!userId) throw new Error('Не удалось определить автора');

    await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });

    return { ok: true, userId };
}

export const REPORT_META = { TARGET_TYPES, REASONS, STATUSES };