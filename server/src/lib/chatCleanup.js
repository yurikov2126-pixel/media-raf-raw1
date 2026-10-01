import { prisma } from './prisma.js';

/**
 * Удаляет чат со всеми зависимостями в транзакции.
 * Используется и при ручном удалении, и при очистке висячих чатов.
 */
export async function hardDeleteChat(tx, chatId) {
    await tx.chat.update({
        where: { id: chatId },
        data: { pinnedMessageId: null },
    });

    const msgs = await tx.message.findMany({
        where: { chatId },
        select: { id: true },
    });
    const msgIds = msgs.map((m) => m.id);

    if (msgIds.length > 0) {
        await tx.message.updateMany({
            where: { replyToId: { in: msgIds } },
            data: { replyToId: null },
        });
        await tx.reaction.deleteMany({ where: { messageId: { in: msgIds } } });
        await tx.message.deleteMany({ where: { id: { in: msgIds } } });
    }

    await tx.chatMember.deleteMany({ where: { chatId } });
    await tx.chat.delete({ where: { id: chatId } });
}

/**
 * Возвращает список id "мёртвых" чатов:
 *   - DIRECT с числом участников < 2
 *   - GROUP с числом участников < 1
 *
 * Использует _count, чтобы не тянуть все связи.
 */
export async function findOrphanChatIds() {
    const chats = await prisma.chat.findMany({
        include: { _count: { select: { members: true } } },
    });

    const orphans = [];
    for (const c of chats) {
        if (c.type === 'DIRECT' && c._count.members < 2) orphans.push(c.id);
        else if (c.type === 'GROUP' && c._count.members < 1) orphans.push(c.id);
    }
    return orphans;
}

/**
 * Полная очистка всех висячих чатов.
 * Возвращает количество удалённых.
 */
export async function cleanupOrphanChats() {
    const orphans = await findOrphanChatIds();
    let deleted = 0;
    for (const id of orphans) {
        try {
            await prisma.$transaction((tx) => hardDeleteChat(tx, id));
            deleted++;
        } catch (e) {
            console.error('[chatCleanup] failed for', id, e.message);
        }
    }
    return { deleted, ids: orphans };
}

/**
 * Очистка только тех чатов, которые могли остаться после удаления
 * конкретного пользователя. Быстрее, чем полная очистка, и точнее.
 */
export async function cleanupAfterUserDelete(affectedChatIds) {
    if (!affectedChatIds || affectedChatIds.length === 0) {
        return { deleted: 0 };
    }

    const chats = await prisma.chat.findMany({
        where: { id: { in: affectedChatIds } },
        include: { _count: { select: { members: true } } },
    });

    let deleted = 0;
    for (const c of chats) {
        const dead =
            (c.type === 'DIRECT' && c._count.members < 2) ||
            (c.type === 'GROUP' && c._count.members < 1);
        if (!dead) continue;

        try {
            await prisma.$transaction((tx) => hardDeleteChat(tx, c.id));
            deleted++;
        } catch (e) {
            console.error('[chatCleanup] after user delete failed for', c.id, e.message);
        }
    }
    return { deleted };
}

/**
 * Правдивая статистика по чатам и сообщениям.
 * Считает только "живые" чаты и их сообщения.
 */
export async function getLiveChatStats() {
    const chats = await prisma.chat.findMany({
        include: { _count: { select: { members: true, messages: true } } },
    });

    let liveChats = 0;
    let liveMessages = 0;

    for (const c of chats) {
        const alive =
            c.type === 'DIRECT' ? c._count.members >= 2 : c._count.members >= 1;
        if (alive) {
            liveChats++;
            liveMessages += c._count.messages;
        }
    }

    return {
        liveChats,
        liveMessages,
        dbTotalChats: chats.length,
        orphanChats: chats.length - liveChats,
    };
}