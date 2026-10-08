import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { safe } from './_shared.js';

const router = Router();

const LIMIT_PER_SECTION = 5;
const MIN_QUERY_LENGTH = 2;

/**
 * Глобальный поиск для command palette.
 * Ищет параллельно по users, courses, posts, certificates, wiki.
 *
 * Query: q — поисковый запрос (мин. 2 символа)
 */
router.get(
    '/search',
    safe(async (req, res) => {
        const q = String(req.query.q || '').trim();

        if (q.length < MIN_QUERY_LENGTH) {
            return res.json({
                query: q,
                users: [],
                courses: [],
                posts: [],
                certificates: [],
                wiki: [],
            });
        }

        const contains = { contains: q, mode: 'insensitive' };

        const [users, courses, posts, certificates, wiki] = await Promise.all([
            prisma.user.findMany({
                where: {
                    OR: [
                        { fullName: contains },
                        { username: contains },
                        { phone: { contains: q } },
                        { email: contains },
                    ],
                },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    avatar: true,
                    role: true,
                    isBanned: true,
                },
                take: LIMIT_PER_SECTION,
                orderBy: { fullName: 'asc' },
            }),

            prisma.course.findMany({
                where: {
                    OR: [{ title: contains }, { slug: contains }],
                },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    category: true,
                    published: true,
                },
                take: LIMIT_PER_SECTION,
                orderBy: { title: 'asc' },
            }),

            prisma.post.findMany({
                where: { content: contains },
                select: {
                    id: true,
                    content: true,
                    mediaUrl: true,
                    createdAt: true,
                    author: {
                        select: { id: true, username: true, fullName: true, avatar: true },
                    },
                },
                take: LIMIT_PER_SECTION,
                orderBy: { createdAt: 'desc' },
            }),

            prisma.certificate.findMany({
                where: {
                    OR: [
                        { serial: contains },
                        { title: contains },
                    ],
                },
                select: {
                    id: true,
                    serial: true,
                    title: true,
                    issuedAt: true,
                    user: { select: { username: true, fullName: true } },
                    course: { select: { slug: true, title: true } },
                },
                take: LIMIT_PER_SECTION,
                orderBy: { issuedAt: 'desc' },
            }),

            prisma.wikiArticle.findMany({
                where: {
                    OR: [{ title: contains }, { slug: contains }],
                },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    published: true,
                    category: { select: { title: true } },
                },
                take: LIMIT_PER_SECTION,
                orderBy: { title: 'asc' },
            }),
        ]);

        res.json({
            query: q,
            users,
            courses,
            posts: posts.map((p) => ({
                id: p.id,
                excerpt: (p.content || '').slice(0, 120),
                hasMedia: !!p.mediaUrl,
                createdAt: p.createdAt,
                author: p.author,
            })),
            certificates,
            wiki,
        });
    })
);

export default router;