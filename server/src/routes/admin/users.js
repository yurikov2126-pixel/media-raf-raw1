import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { cleanupAfterUserDelete } from '../../lib/chatCleanup.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ ПОЛЬЗОВАТЕЛИ ═══════════ */
router.get(
    '/users',
    safe(async (_req, res) => {
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(users.map(({ passwordHash, ...u }) => u));
    })
);

router.patch(
    '/users/:id',
    safe(async (req, res) => {
        const { role, isBanned, direction } = req.body;
        const allowed = ['STUDENT', 'MENTOR', 'ADMIN'];
        if (role && !allowed.includes(role))
            return res.status(400).json({ error: 'Недопустимая роль' });

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                ...(role && { role }),
                ...(isBanned !== undefined && { isBanned }),
                ...(direction && { direction }),
            },
        });
        const { passwordHash, ...rest } = user;
        res.json(rest);
    })
);

router.patch(
    '/users/:id/password',
    safe(async (req, res) => {
        const { newPassword } = req.body;
        if (!newPassword || String(newPassword).length < 6)
            return res.status(400).json({ error: 'Пароль не короче 6 символов' });

        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.params.id },
            data: {
                passwordHash,
                passwordChangedAt: new Date(),
            },
        });
        res.json({ ok: true, fullName: user.fullName });
    })
);

router.delete(
    '/users/:id',
    safe(async (req, res) => {
        const userId = req.params.id;
        if (userId === req.user.id)
            return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const affectedChatIds = (
            await prisma.chatMember.findMany({
                where: { userId },
                select: { chatId: true },
            })
        ).map((m) => m.chatId);

        await prisma.$transaction(async (tx) => {
            const userMessages = await tx.message.findMany({
                where: { senderId: userId },
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

            await tx.comment.deleteMany({ where: { authorId: userId } });
            await tx.postReaction.deleteMany({ where: { userId } });
            await tx.reaction.deleteMany({ where: { userId } });
            await tx.chatMember.deleteMany({ where: { userId } });
            await tx.lessonProgress.deleteMany({ where: { userId } });
            await tx.testAttempt.deleteMany({ where: { userId } });
            await tx.enrollment.deleteMany({ where: { userId } });
            await tx.certificate.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.post.deleteMany({ where: { authorId: userId } });
            await tx.chat.updateMany({
                where: { createdBy: userId },
                data: { createdBy: null },
            });
            await tx.user.delete({ where: { id: userId } });
        });

        const cleanup = await cleanupAfterUserDelete(affectedChatIds);
        res.json({ ok: true, cleanedChats: cleanup.deleted });
    })
);

export default router;