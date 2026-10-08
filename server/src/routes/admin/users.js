import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { scheduleDeletion } from '../../lib/pendingDeletion.js';
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

        // Не удаляем сразу — ставим в очередь на 30 сек.
        // Реальное удаление делает воркер processPendingDeletions().
        // Админ может отменить через POST /admin/undo/:token.
        const row = await scheduleDeletion({
            entityType: 'user',
            entityId: userId,
            adminId: req.user.id,
            action: 'delete_user',
        });

        res.json({
            ok: true,
            undoToken: row.id,
            executeAt: row.executeAt,
            undoWindowMs: 30_000,
        });
    })
);

export default router;