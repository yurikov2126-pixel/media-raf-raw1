import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';
import { notifyChatMessage, notifyMention, buildPreview } from './lib/notify.js';

const onlineUsers = new Map();

function markOnline(userId, socketId) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
}

function markOffline(userId, socketId) {
    const s = onlineUsers.get(userId);
    if (!s) return false;
    s.delete(socketId);
    if (s.size === 0) {
        onlineUsers.delete(userId);
        return true;
    }
    return false;
}

export function getOnlineUserIds() {
    return Array.from(onlineUsers.keys());
}

function extractMentions(text) {
    if (!text) return [];
    const re = /@([a-z0-9_]{3,20})/gi;
    const set = new Set();
    let m;
    while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
    return Array.from(set);
}

export function initSocket(io) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.id;
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;

        const wasOffline = !onlineUsers.has(userId);
        markOnline(userId, socket.id);

        const memberships = await prisma.chatMember.findMany({ where: { userId } });
        memberships.forEach((m) => socket.join(`chat:${m.chatId}`));
        socket.join(`user:${userId}`);

        if (wasOffline) io.emit('user:online', { userId });

        socket.on('users:online', (cb) => cb?.({ ids: getOnlineUserIds() }));

        socket.on('chat:join', async (chatId) => {
            const member = await prisma.chatMember.findUnique({
                where: { chatId_userId: { chatId, userId } },
            });
            if (member) socket.join(`chat:${chatId}`);
        });

        socket.on('message:send', async (payload, cb) => {
            try {
                const { chatId, content, type = 'text', replyToId, forwardedFrom, caption, clientMessageId } = payload;
                const member = await prisma.chatMember.findUnique({
                    where: { chatId_userId: { chatId, userId } },
                });
                if (!member) return cb?.({ error: 'Нет доступа' });

                const requestId = typeof clientMessageId === 'string' && /^[0-9a-f-]{36}$/i.test(clientMessageId) ? clientMessageId : null;
                const includeMessage = {
                    sender: { select: { id: true, fullName: true, username: true, avatar: true } },
                    replyTo: { include: { sender: { select: { id: true, fullName: true } } } },
                    reactions: true,
                };
                if (requestId) {
                    const existing = await prisma.message.findUnique({
                        where: { senderId_clientMessageId: { senderId: userId, clientMessageId: requestId } },
                        include: includeMessage,
                    });
                    if (existing) return cb?.(existing.chatId === chatId ? { ok: true, message: existing, duplicate: true } : { error: 'Конфликт идентификатора сообщения' });
                }

                let message;
                try {
                    message = await prisma.message.create({
                    data: {
                        chatId, senderId: userId, content, type, clientMessageId: requestId,
                        caption: ['image', 'video', 'file'].includes(type) && typeof caption === 'string' ? caption.trim().slice(0, 2000) || null : null,
                        replyToId: replyToId || null,
                        forwardedFrom: forwardedFrom ? JSON.stringify(forwardedFrom) : null,
                    },
                    include: includeMessage,
                    });
                } catch (error) {
                    if (error.code !== 'P2002' || !requestId) throw error;
                    const existing = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: userId, clientMessageId: requestId } }, include: includeMessage });
                    if (!existing || existing.chatId !== chatId) return cb?.({ error: 'Конфликт идентификатора сообщения' });
                    return cb?.({ ok: true, message: existing, duplicate: true });
                }

                io.to(`chat:${chatId}`).emit('message:new', message);

                const chat = await prisma.chat.findUnique({ where: { id: chatId } });
                const members = await prisma.chatMember.findMany({
                    where: { chatId },
                    include: { user: { select: { id: true, username: true } } },
                });

                const mentionedUsernames = type === 'text' ? extractMentions(content) : [];
                const mentionedIds = new Set();
                for (const m of members) {
                    if (mentionedUsernames.includes(m.user.username.toLowerCase()) && m.userId !== userId) {
                        mentionedIds.add(m.userId);
                    }
                }

                const title = chat.type === 'GROUP' ? chat.title : message.sender.fullName;
                const preview = buildPreview(message);

                for (const m of members) {
                    if (m.userId === userId) continue;
                    io.to(`user:${m.userId}`).emit('chat:updated', { chatId });

                    if (mentionedIds.has(m.userId)) {
                        await notifyMention(m.userId, {
                            chatId, chatTitle: title, messageId: message.id,
                            senderName: message.sender.fullName, preview,
                        });
                    } else {
                        await notifyChatMessage(m.userId, chatId, title, message);
                    }
                }

                cb?.({ ok: true, message });
            } catch (e) {
                console.error('message:send', e);
                cb?.({ error: 'Ошибка отправки' });
            }
        });

        socket.on('message:edit', async ({ messageId, content }, cb) => {
            try {
                const msg = await prisma.message.findUnique({ where: { id: messageId } });
                if (!msg || msg.senderId !== userId) return cb?.({ error: 'Нет прав' });
                const updated = await prisma.message.update({
                    where: { id: messageId },
                    data: { content, editedAt: new Date() },
                    include: {
                        sender: { select: { id: true, fullName: true, username: true, avatar: true } },
                        replyTo: { include: { sender: { select: { id: true, fullName: true } } } },
                        reactions: true,
                    },
                });
                io.to(`chat:${msg.chatId}`).emit('message:edited', updated);
                cb?.({ ok: true });
            } catch (e) { console.error('message:edit', e); cb?.({ error: 'Ошибка' }); }
        });

        socket.on('message:delete', async ({ messageId }, cb) => {
            try {
                const msg = await prisma.message.findUnique({ where: { id: messageId } });
                if (!msg || msg.senderId !== userId) return cb?.({ error: 'Нет прав' });
                await prisma.message.update({
                    where: { id: messageId },
                    data: { deletedAt: new Date(), content: '' },
                });

                const chat = await prisma.chat.findUnique({ where: { id: msg.chatId } });
                if (chat?.pinnedMessageId === messageId) {
                    await prisma.chat.update({
                        where: { id: msg.chatId },
                        data: { pinnedMessageId: null },
                    });
                    io.to(`chat:${msg.chatId}`).emit('chat:pinned', { chatId: msg.chatId, message: null });
                }

                io.to(`chat:${msg.chatId}`).emit('message:deleted', { messageId });
                cb?.({ ok: true });
            } catch (e) { console.error('message:delete', e); cb?.({ error: 'Ошибка' }); }
        });

        socket.on('reaction:toggle', async ({ messageId, emoji }) => {
            try {
                const existing = await prisma.reaction.findUnique({
                    where: { messageId_userId_emoji: { messageId, userId, emoji } },
                });
                let action;
                if (existing) {
                    await prisma.reaction.delete({ where: { id: existing.id } });
                    action = 'removed';
                } else {
                    await prisma.reaction.create({ data: { messageId, userId, emoji } });
                    action = 'added';
                }
                const msg = await prisma.message.findUnique({ where: { id: messageId } });
                io.to(`chat:${msg.chatId}`).emit('reaction:update', { messageId, emoji, userId, action });
            } catch (e) { console.error('reaction:toggle', e); }
        });

        socket.on('typing', ({ chatId, isTyping }) => {
            socket.to(`chat:${chatId}`).emit('typing', { chatId, userId, isTyping });
        });

        socket.on('disconnect', async () => {
            const nowOffline = markOffline(userId, socket.id);
            if (nowOffline) {
                try {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { lastSeen: new Date() },
                    });
                } catch {}
                io.emit('user:offline', { userId });
            }
        });
    });
}