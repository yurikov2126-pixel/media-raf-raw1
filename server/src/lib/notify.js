import { prisma } from './prisma.js';
import { sendPushToUser } from './push.js';

let _io = null;
export function setIo(io) { _io = io; }
export function getIo() { return _io; }

export function buildPreview(message) {
    if (!message) return '';
    switch (message.type) {
        case 'image': return '🖼️ Изображение';
        case 'video': return '🎥 Видео';
        case 'voice': return '🎤 Голосовое сообщение';
        case 'file': return '📎 Файл';
        case 'sticker': return '🎨 Стикер';
        default: return (message.content || '').slice(0, 120);
    }
}

export async function createNotification(userId, type, payload) {
    try {
        const n = await prisma.notification.create({
            data: { userId, type, payload: JSON.stringify(payload) },
        });

        // Отправляем в сокет (вкладка открыта)
        if (_io) _io.to(`user:${userId}`).emit('notification:new', { ...n, payload });

        // Отправляем web push (вкладка закрыта / фон)
        sendPushToUser(userId, payloadToPush(type, payload)).catch((e) =>
            console.error('[notify] push error:', e)
        );

        return n;
    } catch (e) {
        console.error('createNotification error', e);
        return null;
    }
}

function payloadToPush(type, payload) {
    if (type === 'message') {
        return {
            title: payload.chatTitle || payload.senderName || 'Новое сообщение',
            body: payload.preview || '',
            url: payload.chatId ? `/app/chats/${payload.chatId}` : '/app',
            tag: `chat-${payload.chatId || 'x'}`,
        };
    }
    if (type === 'mention') {
        return {
            title: `${payload.senderName || 'Кто-то'} упомянул вас`,
            body: payload.preview || '',
            url: payload.chatId ? `/app/chats/${payload.chatId}` : '/app',
            tag: `mention-${payload.chatId || 'x'}`,
        };
    }
    if (type === 'certificate') {
        return {
            title: '🏆 Новый сертификат',
            body: payload.courseTitle || '',
            url: payload.certificateId ? `/app/certificates/${payload.certificateId}` : '/app',
            tag: `cert-${payload.certificateId || 'x'}`,
        };
    }
    if (type === 'post') {
        return {
            title: `📝 Новый пост от ${payload.authorName || 'автора'}`,
            body: payload.preview || '',
            url: payload.authorUsername ? `/app/u/${payload.authorUsername}` : '/app',
            tag: `post-${payload.postId || 'x'}`,
        };
    }
    if (type === 'system') {
        return {
            title: payload.title || 'MEDIA·RAF·RAW',
            body: payload.message || '',
            url: '/app',
            tag: `sys-${Date.now()}`,
        };
    }
    return { title: 'MEDIA·RAF·RAW', body: 'Новое уведомление', url: '/app' };
}

export async function notifyChatMessage(userId, chatId, chatTitle, message) {
    const existing = await prisma.notification.findMany({
        where: { userId, type: 'message', readAt: null },
    });
    const toDelete = existing.filter((n) => {
        try { return JSON.parse(n.payload || '{}').chatId === chatId; }
        catch { return false; }
    });
    if (toDelete.length) {
        await prisma.notification.deleteMany({
            where: { id: { in: toDelete.map((n) => n.id) } },
        });
    }
    return createNotification(userId, 'message', {
        chatId,
        chatTitle,
        messageId: message.id,
        senderName: message.sender.fullName,
        preview: buildPreview(message),
    });
}

export async function notifyMention(userId, payload) {
    return createNotification(userId, 'mention', payload);
}

export async function notifyBroadcast(userId, payload) {
    return createNotification(userId, 'system', payload);
}