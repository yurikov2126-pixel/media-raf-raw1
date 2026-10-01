import { prisma } from './prisma.js';

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/**
 * Возвращает массив дат за последние N дней (включая сегодня).
 */
function dateRange(days) {
    const out = [];
    const today = startOfDay(new Date());
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        out.push(d);
    }
    return out;
}

function formatKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function getAnalytics(periodDays = 30) {
    const days = dateRange(periodDays);
    const start = days[0];
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Регистрации
    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
    });
    const registrationsByDay = days.map((d) => ({
        date: formatKey(d),
        label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        value: 0,
    }));
    const regIndex = new Map(registrationsByDay.map((x, i) => [x.date, i]));
    for (const u of users) {
        const key = formatKey(startOfDay(u.createdAt));
        if (regIndex.has(key)) registrationsByDay[regIndex.get(key)].value++;
    }

    // Активность — сообщения + комментарии + посты
    const [messages, comments, posts] = await Promise.all([
        prisma.message.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
        prisma.comment.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
        prisma.post.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
        }),
    ]);

    const activityByDay = days.map((d) => ({
        date: formatKey(d),
        label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        messages: 0,
        comments: 0,
        posts: 0,
        total: 0,
    }));
    const actIndex = new Map(activityByDay.map((x, i) => [x.date, i]));
    const bump = (date, key) => {
        const k = formatKey(startOfDay(date));
        const i = actIndex.get(k);
        if (i === undefined) return;
        activityByDay[i][key]++;
        activityByDay[i].total++;
    };
    messages.forEach((m) => bump(m.createdAt, 'messages'));
    comments.forEach((c) => bump(c.createdAt, 'comments'));
    posts.forEach((p) => bump(p.createdAt, 'posts'));

    // Топ курсов (по числу записей)
    const topCourses = await prisma.course.findMany({
        take: 10,
        orderBy: { enrollments: { _count: 'desc' } },
        select: {
            id: true,
            title: true,
            category: true,
            _count: { select: { enrollments: true, certificates: true } },
        },
    });

    // Топ постов (по комментариям + реакциям)
    const postsRaw = await prisma.post.findMany({
        take: 50,
        include: {
            author: { select: { id: true, fullName: true, username: true } },
            _count: { select: { comments: true, reactions: true } },
        },
    });
    const topPosts = postsRaw
        .map((p) => ({
            id: p.id,
            content: p.content.slice(0, 100),
            createdAt: p.createdAt,
            author: p.author,
            comments: p._count.comments,
            reactions: p._count.reactions,
            score: p._count.comments * 2 + p._count.reactions,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    // Общая сводка
    const [totalUsers, totalCourses, totalMessages, totalPosts, totalComments] =
        await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.message.count(),
            prisma.post.count(),
            prisma.comment.count(),
        ]);

    return {
        period: periodDays,
        totals: {
            users: totalUsers,
            courses: totalCourses,
            messages: totalMessages,
            posts: totalPosts,
            comments: totalComments,
        },
        registrationsByDay,
        activityByDay,
        topCourses: topCourses.map((c) => ({
            id: c.id,
            title: c.title,
            category: c.category,
            enrollments: c._count.enrollments,
            certificates: c._count.certificates,
        })),
        topPosts,
    };
}