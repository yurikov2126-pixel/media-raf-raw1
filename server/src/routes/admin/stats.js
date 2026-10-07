import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getLiveChatStats } from '../../lib/chatCleanup.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ ДАШБОРД ═══════════ */
router.get(
    '/stats',
    safe(async (_req, res) => {
        const [users, courses, enrollments, certificates, posts] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.enrollment.count(),
            prisma.certificate.count(),
            prisma.post.count(),
        ]);
        const chatStats = await getLiveChatStats();
        res.json({
            users,
            courses,
            enrollments,
            certificates,
            posts,
            chats: chatStats.liveChats,
            messages: chatStats.liveMessages,
            dbTotalChats: chatStats.dbTotalChats,
            orphanChats: chatStats.orphanChats,
        });
    })
);

export default router;