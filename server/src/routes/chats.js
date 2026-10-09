import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUserIds } from '../socket.js';
import { getIo } from '../lib/notify.js';
import { hardDeleteChat } from '../lib/chatCleanup.js';

const router = Router();

router.get('/', auth, async (req, res) => {
    const members = await prisma.chatMember.findMany({
        where: { userId: req.user.id },
        include: {
            chat: {
                include: {
                    members: {
                        include: {
                            user: {
                                select: { id: true, fullName: true, username: true, avatar: true, lastSeen: true },
                            },
                        },
                    },
                    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
            },
        },
    });

    const onlineIds = new Set(getOnlineUserIds());

    const chats = members
        .map((m) => {
            const last = m.chat.messages[0] || null;
            return {
                id: m.chat.id,
                type: m.chat.type,
                title: m.chat.title,
                avatar: m.chat.avatar,
                pinnedMessageId: m.chat.pinnedMessageId,
                myRole: m.role,
                members: m.chat.members.map((x) => ({
                    ...x.user,
                    isOnline: onlineIds.has(x.user.id),
                    role: x.role,
                })),
                lastMessage: last,
                unread:
                    last &&
                    new Date(last.createdAt) > new Date(m.lastRead) &&
                    last.senderId !== req.user.id
                        ? 1
                        : 0,
            };
        })
        .filter((c) => (c.type === 'DIRECT' ? c.members.length >= 2 : c.members.length >= 1))
        .sort(
            (a, b) =>
                new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0)
        );

    res.json(chats);
});

router.post('/direct', auth, async (req, res) => {
    const { userId } = req.body;
    if (userId === req.user.id) return res.status(400).json({ error: 'Нельзя чат с собой' });

    const existing = await prisma.chat.findFirst({
        where: {
            type: 'DIRECT',
            AND: [
                { members: { some: { userId: req.user.id } } },
                { members: { some: { userId } } },
            ],
        },
        include: { members: true },
    });
    if (existing && existing.members.length === 2) return res.json(existing);

    const chat = await prisma.chat.create({
        data: {
            type: 'DIRECT',
            createdBy: req.user.id,
            members: { create: [{ userId: req.user.id }, { userId }] },
        },
    });
    res.json(chat);
});

router.post('/group', auth, async (req, res) => {
    const { title, memberIds = [], avatar } = req.body;
    if (!title) return res.status(400).json({ error: 'Введите название' });
    const ids = [...new Set([req.user.id, ...memberIds])];
    const chat = await prisma.chat.create({
        data: {
            type: 'GROUP', title, avatar, createdBy: req.user.id,
            members: {
                create: ids.map((id) => ({
                    userId: id,
                    role: id === req.user.id ? 'admin' : 'member',
                })),
            },
        },
    });
    res.json(chat);
});

/**
 * Сообщения чата + firstUnreadId.
 * Возвращаем id первого непрочитанного сообщения (или null), чтобы
 * клиент мог проскроллить к нему. Если непрочитанных нет — клиент
 * скроллит к самому низу.
 */
router.get('/:id/messages', auth, async (req, res) => {
    const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Нет доступа' });

    const previousLastRead = member.lastRead;

    const messages = await prisma.message.findMany({
        where: { chatId: req.params.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: {
            sender: { select: { id: true, fullName: true, username: true, avatar: true } },
            replyTo: { include: { sender: { select: { id: true, fullName: true } } } },
            reactions: true,
        },
    });

    // Include a search deep-link target even when it falls outside the loaded window.
    if (typeof req.query.focus === 'string' && req.query.focus.length < 128 &&
        !messages.some(m => m.id === req.query.focus)) {
        const target = await prisma.message.findFirst({
            where: { id: req.query.focus, chatId: req.params.id },
            include: {
                sender: { select: { id: true, fullName: true, username: true, avatar: true } },
                replyTo: { include: { sender: { select: { id: true, fullName: true } } } },
                reactions: true,
            },
        });
        if (target) {
            messages.push(target);
            messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
    }

    // Первое сообщение, которое пользователь ещё не видел
    const firstUnread = messages.find(
        (m) =>
            !m.deletedAt &&
            new Date(m.createdAt) > new Date(previousLastRead) &&
            m.senderId !== req.user.id
    );

    await prisma.chatMember.update({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
        data: { lastRead: new Date() },
    });

    const chat = await prisma.chat.findUnique({ where: { id: req.params.id } });
    let pinned = null;
    if (chat?.pinnedMessageId) {
        pinned = await prisma.message.findUnique({
            where: { id: chat.pinnedMessageId },
            include: { sender: { select: { id: true, fullName: true, username: true } } },
        });
    }

    res.json({
        messages,
        pinned,
        myRole: member.role,
        firstUnreadId: firstUnread?.id || null,
    });
});

router.get('/:id/media', auth, async (req, res) => {
    const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Нет доступа' });

    const { type } = req.query;
    const where = {
        chatId: req.params.id,
        deletedAt: null,
        type: type ? type : { in: ['image', 'video', 'file', 'voice'] },
    };

    const media = await prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
        select: {
            id: true, type: true, content: true, createdAt: true,
            sender: { select: { id: true, fullName: true, username: true } },
        },
    });
    res.json(media);
});

router.post('/:id/pin', auth, async (req, res) => {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId обязателен' });

    const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Нет доступа' });

    const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { sender: { select: { id: true, fullName: true, username: true } } },
    });
    if (!message || message.chatId !== req.params.id)
        return res.status(404).json({ error: 'Сообщение не найдено' });

    await prisma.chat.update({
        where: { id: req.params.id },
        data: { pinnedMessageId: messageId },
    });
    res.json({ ok: true, message });
});

router.delete('/:id/pin', auth, async (req, res) => {
    const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.chat.update({
        where: { id: req.params.id },
        data: { pinnedMessageId: null },
    });
    res.json({ ok: true });
});

router.get('/:id/members', auth, async (req, res) => {
    const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: req.params.id, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Нет доступа' });

    const onlineIds = new Set(getOnlineUserIds());
    const list = await prisma.chatMember.findMany({
        where: { chatId: req.params.id },
        include: {
            user: {
                select: {
                    id: true, fullName: true, username: true, avatar: true,
                    direction: true, lastSeen: true,
                },
            },
        },
    });

    res.json(list.map((m) => ({ ...m.user, role: m.role, isOnline: onlineIds.has(m.user.id) })));
});

router.delete('/:id', auth, async (req, res) => {
    const chatId = req.params.id;
    const io = getIo();
    try {
        const member = await prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json({ error: 'Нет доступа' });

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat) return res.status(404).json({ error: 'Чат не найден' });

        const isGroupAdmin = chat.type === 'GROUP' && member.role === 'admin';

        if (isGroupAdmin) {
            await prisma.$transaction((tx) => hardDeleteChat(tx, chatId));
            if (io) io.to(`chat:${chatId}`).emit('chat:deleted', { chatId, whole: true });
            return res.json({ ok: true, mode: 'whole' });
        }

        await prisma.chatMember.delete({
            where: { chatId_userId: { chatId, userId: req.user.id } },
        });

        const remaining = await prisma.chatMember.count({ where: { chatId } });
        if (remaining === 0) {
            await prisma.$transaction((tx) => hardDeleteChat(tx, chatId));
            if (io) io.to(`chat:${chatId}`).emit('chat:deleted', { chatId, whole: true });
            return res.json({ ok: true, mode: 'whole' });
        }

        if (chat.type === 'GROUP' && member.role === 'admin') {
            const next = await prisma.chatMember.findFirst({
                where: { chatId },
                orderBy: { joinedAt: 'asc' },
            });
            if (next) {
                await prisma.chatMember.update({
                    where: { id: next.id },
                    data: { role: 'admin' },
                });
            }
        }

        if (io) {
            io.to(`user:${req.user.id}`).emit('chat:deleted', { chatId, whole: false });
            io.to(`chat:${chatId}`).except(`user:${req.user.id}`).emit('chat:updated', { chatId });
        }

        res.json({ ok: true, mode: 'leave' });
    } catch (e) {
        console.error('[chats] delete error:', e);
        res.status(500).json({ error: e.message || 'Не удалось удалить чат' });
    }
});

export default router;