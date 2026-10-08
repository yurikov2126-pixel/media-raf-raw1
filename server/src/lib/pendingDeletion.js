import { prisma } from './prisma.js';
import { cleanupAfterUserDelete } from './chatCleanup.js';

/* ──────────────── Очередь отложенного удаления ────────────────
   При DELETE-запросе мы не удаляем сразу, а создаём запись в PendingDeletion
   с executeAt = now + окно. Cron раз в 30 секунд сносит всё, что просрочено.
   Если админ успел нажать «Отменить» — запись из очереди удаляется,
   реальные данные не тронуты. */

export const UNDO_WINDOW_MS = 30_000;

/**
 * Запланировать удаление. Возвращает запись с id (undoToken) и executeAt.
 * Бросает P2002, если для этой сущности уже есть запись в очереди — errorHandler
 * превратит её в 409.
 */
export async function scheduleDeletion({ entityType, entityId, adminId, action }) {
    const executeAt = new Date(Date.now() + UNDO_WINDOW_MS);
    return prisma.pendingDeletion.create({
        data: { entityType, entityId, adminId, action, executeAt },
    });
}

/**
 * Отменить запланированное удаление по токену.
 * Возвращает { ok: true } если отменили, { ok: false, reason } — если уже поздно
 * или токен неизвестен.
 */
export async function undoPendingDeletion(token) {
    const row = await prisma.pendingDeletion.findUnique({ where: { id: token } });
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.executeAt <= new Date()) return { ok: false, reason: 'expired' };

    await prisma.pendingDeletion.delete({ where: { id: token } });
    return { ok: true, entityType: row.entityType, entityId: row.entityId };
}

/* ─────────── Исполнители по типам ───────────
   Логика удаления каждой сущности. Всё, что раньше было в роутах,
   переезжает сюда — потому что реальное удаление теперь происходит
   в воркере, а не в HTTP-запросе. */

const EXECUTORS = {
    user: async (id) => {
        // Запоминаем чаты ДО удаления — после удаления ChatMember пропадут,
        // и мы не сможем определить, какие чаты остались без участников.
        const affectedChatIds = (
            await prisma.chatMember.findMany({
                where: { userId: id },
                select: { chatId: true },
            })
        ).map((m) => m.chatId);

        await prisma.$transaction(async (tx) => {
            const userMessages = await tx.message.findMany({
                where: { senderId: id },
                select: { id: true },
            });
            const msgIds = userMessages.map((m) => m.id);

            if (msgIds.length > 0) {
                await tx.message.updateMany({
                    where: { replyToId: { in: msgIds } },
                    data: { replyToId: null },
                });
                await tx.chat.updateMany({
                    where: { pinnedMessageId: { in: msgIds } },
                    data: { pinnedMessageId: null },
                });
                await tx.reaction.deleteMany({ where: { messageId: { in: msgIds } } });
                await tx.message.deleteMany({ where: { id: { in: msgIds } } });
            }

            await tx.comment.deleteMany({ where: { authorId: id } });
            await tx.postReaction.deleteMany({ where: { userId: id } });
            await tx.reaction.deleteMany({ where: { userId: id } });
            await tx.chatMember.deleteMany({ where: { userId: id } });
            await tx.lessonProgress.deleteMany({ where: { userId: id } });
            await tx.testAttempt.deleteMany({ where: { userId: id } });
            await tx.enrollment.deleteMany({ where: { userId: id } });
            await tx.certificate.deleteMany({ where: { userId: id } });
            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.post.deleteMany({ where: { authorId: id } });
            await tx.chat.updateMany({
                where: { createdBy: id },
                data: { createdBy: null },
            });
            await tx.user.delete({ where: { id } });
        });

        // Сносим опустевшие чаты — эта логика не покрывается каскадами Prisma.
        await cleanupAfterUserDelete(affectedChatIds);
    },

    post: async (id) => {
        await prisma.post.delete({ where: { id } });
    },
};

/**
 * Обработать все просроченные записи. Возвращает число выполненных удалений.
 * Ошибки отдельных удалений не валят остальные — логируются и идут дальше.
 */
export async function processPendingDeletions() {
    const now = new Date();
    const due = await prisma.pendingDeletion.findMany({
        where: { executeAt: { lte: now } },
        orderBy: { executeAt: 'asc' },
        take: 100,
    });

    let done = 0;
    for (const row of due) {
        const executor = EXECUTORS[row.entityType];
        if (!executor) {
            console.error('[pendingDeletion] no executor for', row.entityType);
            await prisma.pendingDeletion.delete({ where: { id: row.id } }).catch(() => {});
            continue;
        }
        try {
            await executor(row.entityId);
            done++;
        } catch (e) {
            // P2025 — запись уже удалена другим способом. Это ок, не считаем ошибкой.
            if (e.code !== 'P2025') {
                console.error(
                    '[pendingDeletion] execute failed',
                    row.entityType,
                    row.entityId,
                    e.message
                );
            }
        } finally {
            await prisma.pendingDeletion
                .delete({ where: { id: row.id } })
                .catch(() => {});
        }
    }
    return done;
}

/**
 * Запустить периодический обработчик. Вызывается один раз из src/index.js.
 */
export function startPendingDeletionWorker() {
    const INTERVAL_MS = 30_000;

    // Первый запуск — сразу, чтобы подхватить «висяки» после рестарта.
    processPendingDeletions().catch((e) =>
        console.error('[pendingDeletion] initial run failed', e.message)
    );

    const timer = setInterval(() => {
        processPendingDeletions().catch((e) =>
            console.error('[pendingDeletion] periodic run failed', e.message)
        );
    }, INTERVAL_MS);

    timer.unref?.();
    return () => clearInterval(timer);
}