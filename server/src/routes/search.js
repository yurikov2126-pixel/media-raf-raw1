import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { isModuleEnabled } from '../lib/modules.js';

const router = Router();
router.get('/', auth, async (req, res, next) => {
    try {
        const q = String(req.query.q || '').trim().slice(0, 100);
        if (q.length < 2) return res.json({ people: [], posts: [], chats: [], messages: [] });
        const match = { contains: q, mode: 'insensitive' };
        const [feedOn, chatsOn] = await Promise.all([isModuleEnabled('feed'), isModuleEnabled('chats')]);
        const [people, posts, memberships, messages] = await Promise.all([
            prisma.user.findMany({ where: { isBanned: false, OR: [{ fullName: match }, { username: match }] }, select: { id: true, fullName: true, username: true, avatar: true }, take: 12 }),
            feedOn ? prisma.post.findMany({ where: { content: match, author: { isBanned: false } }, select: { id: true, content: true, author: { select: { fullName: true } } }, take: 12, orderBy: { createdAt: 'desc' } }) : [],
            chatsOn ? prisma.chatMember.findMany({ where: { userId: req.user.id }, select: { chat: { select: { id: true, title: true, type: true, members: { select: { user: { select: { id: true, fullName: true } } } } } } } }) : [],
            chatsOn ? prisma.message.findMany({ where: { type: 'text', deletedAt: null, content: match, chat: { members: { some: { userId: req.user.id } } } }, select: { id: true, chatId: true, content: true, sender: { select: { fullName: true } } }, take: 20, orderBy: { createdAt: 'desc' } }) : [],
        ]);
        const chats = memberships.map(({ chat }) => ({ id: chat.id, title: chat.type === 'GROUP' ? chat.title || 'Группа' : chat.members.find(m => m.user.id !== req.user.id)?.user.fullName || 'Чат' })).filter(c => c.title.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
        res.json({ people, posts, chats, messages });
    } catch (error) { next(error); }
});
export default router;
