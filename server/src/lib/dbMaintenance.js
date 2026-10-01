import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './prisma.js';
import { hardDeleteChat } from './chatCleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads');

/* ─────────────────────── SCAN ─────────────────────── */

async function findOrphanChats() {
    const chats = await prisma.chat.findMany({
        include: { _count: { select: { members: true } } },
    });
    return chats
        .filter((c) => (c.type === 'DIRECT' ? c._count.members < 2 : c._count.members < 1))
        .map((c) => c.id);
}

async function findOrphanChatMembers() {
    const list = await prisma.$queryRawUnsafe(`
        SELECT cm.id FROM ChatMember cm
                              LEFT JOIN Chat c ON c.id = cm.chatId
                              LEFT JOIN User u ON u.id = cm.userId
        WHERE c.id IS NULL OR u.id IS NULL
    `);
    return list.map((r) => r.id);
}

async function findOrphanMessages() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT m.id FROM Message m
    LEFT JOIN Chat c ON c.id = m.chatId
    LEFT JOIN User u ON u.id = m.senderId
    WHERE c.id IS NULL OR u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanReactions() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT r.id FROM Reaction r
    LEFT JOIN Message m ON m.id = r.messageId
    LEFT JOIN User u ON u.id = r.userId
    WHERE m.id IS NULL OR u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findBadPinnedRefs() {
    const chats = await prisma.chat.findMany({
        where: { pinnedMessageId: { not: null } },
        select: { id: true, pinnedMessageId: true },
    });
    const bad = [];
    for (const c of chats) {
        const msg = await prisma.message.findUnique({
            where: { id: c.pinnedMessageId },
            select: { chatId: true },
        });
        if (!msg || msg.chatId !== c.id) bad.push(c.id);
    }
    return bad;
}

async function findBadReplyRefs() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT m.id FROM Message m
    LEFT JOIN Message r ON r.id = m.replyToId
    WHERE m.replyToId IS NOT NULL
      AND (r.id IS NULL OR r.chatId != m.chatId)
  `);
    return list.map((r) => r.id);
}

async function findOrphanNotifications() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT n.id FROM Notification n
    LEFT JOIN User u ON u.id = n.userId
    WHERE u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanPosts() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT p.id FROM Post p
    LEFT JOIN User u ON u.id = p.authorId
    WHERE u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanEnrollments() {
    const list = await prisma.$queryRawUnsafe(`
        SELECT e.id FROM Enrollment e
                             LEFT JOIN User u ON u.id = e.userId
                             LEFT JOIN Course c ON c.id = e.courseId
        WHERE u.id IS NULL OR c.id IS NULL
    `);
    return list.map((r) => r.id);
}

async function findOrphanLessonProgress() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT lp.id FROM LessonProgress lp
    LEFT JOIN User u ON u.id = lp.userId
    LEFT JOIN Lesson l ON l.id = lp.lessonId
    WHERE u.id IS NULL OR l.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanTestAttempts() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT ta.id FROM TestAttempt ta
    LEFT JOIN User u ON u.id = ta.userId
    LEFT JOIN Test t ON t.id = ta.testId
    WHERE u.id IS NULL OR t.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanCertificates() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT ce.id FROM Certificate ce
    LEFT JOIN User u ON u.id = ce.userId
    LEFT JOIN Course c ON c.id = ce.courseId
    WHERE u.id IS NULL OR c.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanQuestions() {
    const list = await prisma.$queryRawUnsafe(`
        SELECT q.id FROM Question q
                             LEFT JOIN Test t ON t.id = q.testId
        WHERE t.id IS NULL
    `);
    return list.map((r) => r.id);
}

async function findOrphanTests() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT t.id FROM Test t
    LEFT JOIN Lesson l ON l.id = t.lessonId
    WHERE l.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanLessons() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT l.id FROM Lesson l
    LEFT JOIN Course c ON c.id = l.courseId
    WHERE c.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanComments() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT c.id FROM Comment c
    LEFT JOIN Post p ON p.id = c.postId
    LEFT JOIN User u ON u.id = c.authorId
    WHERE p.id IS NULL OR u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findBadCommentParentRefs() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT c.id FROM Comment c
    LEFT JOIN Comment p ON p.id = c.parentId
    WHERE c.parentId IS NOT NULL AND p.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findOrphanPostReactions() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT r.id FROM PostReaction r
    LEFT JOIN Post p ON p.id = r.postId
    LEFT JOIN User u ON u.id = r.userId
    WHERE p.id IS NULL OR u.id IS NULL
  `);
    return list.map((r) => r.id);
}

// Wiki-статьи с битой категорией
async function findOrphanWikiArticles() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT a.id FROM WikiArticle a
    LEFT JOIN WikiCategory c ON c.id = a.categoryId
    WHERE a.categoryId IS NOT NULL AND c.id IS NULL
  `);
    return list.map((r) => r.id);
}

// Push-подписки без пользователя
async function findOrphanPushSubs() {
    const list = await prisma.$queryRawUnsafe(`
    SELECT ps.id FROM PushSubscription ps
    LEFT JOIN User u ON u.id = ps.userId
    WHERE u.id IS NULL
  `);
    return list.map((r) => r.id);
}

async function findDuplicateDirectChats() {
    const chats = await prisma.chat.findMany({
        where: { type: 'DIRECT' },
        include: {
            members: { select: { userId: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });

    const byPair = new Map();
    for (const c of chats) {
        if (c.members.length !== 2) continue;
        const key = c.members.map((m) => m.userId).sort().join('|');
        if (!byPair.has(key)) byPair.set(key, []);
        byPair.get(key).push(c);
    }

    const duplicates = [];
    for (const list of byPair.values()) {
        if (list.length < 2) continue;
        list.sort((a, b) => {
            const aT = a.messages[0]?.createdAt?.getTime() || a.createdAt.getTime();
            const bT = b.messages[0]?.createdAt?.getTime() || b.createdAt.getTime();
            return bT - aT;
        });
        const [keep, ...rest] = list;
        duplicates.push({ keepId: keep.id, removeIds: rest.map((c) => c.id) });
    }
    return duplicates;
}

async function collectUsedFiles() {
    const used = new Set();
    const re = /\/uploads\/([A-Za-z0-9._-]+)/g;
    const extract = (str) => {
        if (!str) return;
        let m;
        while ((m = re.exec(str)) !== null) used.add(m[1]);
    };

    const [users, posts, messages, chats, courses, wikiArticles] = await Promise.all([
        prisma.user.findMany({ select: { avatar: true, cover: true } }),
        prisma.post.findMany({ select: { mediaUrl: true } }),
        prisma.message.findMany({
            where: { type: { in: ['image', 'video', 'file', 'voice'] } },
            select: { content: true },
        }),
        prisma.chat.findMany({ select: { avatar: true } }),
        prisma.course.findMany({ select: { cover: true } }),
        prisma.wikiArticle.findMany({ select: { cover: true } }),
    ]);

    users.forEach((u) => { extract(u.avatar); extract(u.cover); });
    posts.forEach((p) => extract(p.mediaUrl));
    messages.forEach((m) => extract(m.content));
    chats.forEach((c) => extract(c.avatar));
    courses.forEach((c) => extract(c.cover));
    wikiArticles.forEach((w) => extract(w.cover));

    return used;
}

async function findOrphanFiles() {
    if (!fs.existsSync(UPLOADS_DIR)) return [];
    const used = await collectUsedFiles();
    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => !f.startsWith('.'));
    return files.filter((f) => !used.has(f));
}

/* ─────────── Полный скан ─────────── */

export async function scanDatabase() {
    const [
        orphanChats, orphanChatMembers, orphanMessages, orphanReactions,
        badPinnedRefs, badReplyRefs, orphanNotifications, orphanPosts,
        orphanEnrollments, orphanLessonProgress, orphanTestAttempts,
        orphanCertificates, orphanQuestions, orphanTests, orphanLessons,
        orphanComments, badCommentParentRefs, orphanPostReactions,
        orphanWikiArticles, orphanPushSubs,
        duplicateDirectChats, orphanFiles,
    ] = await Promise.all([
        findOrphanChats(),
        findOrphanChatMembers(),
        findOrphanMessages(),
        findOrphanReactions(),
        findBadPinnedRefs(),
        findBadReplyRefs(),
        findOrphanNotifications(),
        findOrphanPosts(),
        findOrphanEnrollments(),
        findOrphanLessonProgress(),
        findOrphanTestAttempts(),
        findOrphanCertificates(),
        findOrphanQuestions(),
        findOrphanTests(),
        findOrphanLessons(),
        findOrphanComments(),
        findBadCommentParentRefs(),
        findOrphanPostReactions(),
        findOrphanWikiArticles(),
        findOrphanPushSubs(),
        findDuplicateDirectChats(),
        findOrphanFiles(),
    ]);

    const duplicateCount = duplicateDirectChats.reduce(
        (sum, d) => sum + d.removeIds.length,
        0
    );

    const categories = [
        { key: 'orphanChats', label: 'Висячие чаты', count: orphanChats.length, hint: 'DIRECT без второго участника / GROUP без участников' },
        { key: 'duplicateDirectChats', label: 'Дубли личных чатов', count: duplicateCount, hint: 'Несколько DIRECT между одними и теми же' },
        { key: 'orphanChatMembers', label: 'Участники удалённых чатов', count: orphanChatMembers.length },
        { key: 'orphanMessages', label: 'Сообщения без чата/автора', count: orphanMessages.length },
        { key: 'orphanReactions', label: 'Реакции без сообщения/автора', count: orphanReactions.length },
        { key: 'badPinnedRefs', label: 'Битые закрепления', count: badPinnedRefs.length },
        { key: 'badReplyRefs', label: 'Битые ответы', count: badReplyRefs.length },
        { key: 'orphanComments', label: 'Комментарии без поста/автора', count: orphanComments.length },
        { key: 'badCommentParentRefs', label: 'Комментарии с битым родителем', count: badCommentParentRefs.length, hint: 'parentId указывает на удалённый комментарий' },
        { key: 'orphanPostReactions', label: 'Реакции на посты без поста/юзера', count: orphanPostReactions.length },
        { key: 'orphanNotifications', label: 'Уведомления без получателя', count: orphanNotifications.length },
        { key: 'orphanPosts', label: 'Посты без автора', count: orphanPosts.length },
        { key: 'orphanEnrollments', label: 'Записи на курсы с битым FK', count: orphanEnrollments.length },
        { key: 'orphanLessonProgress', label: 'Прогресс с битым FK', count: orphanLessonProgress.length },
        { key: 'orphanTestAttempts', label: 'Попытки тестов с битым FK', count: orphanTestAttempts.length },
        { key: 'orphanCertificates', label: 'Сертификаты с битым FK', count: orphanCertificates.length },
        { key: 'orphanQuestions', label: 'Вопросы без теста', count: orphanQuestions.length },
        { key: 'orphanTests', label: 'Тесты без урока', count: orphanTests.length },
        { key: 'orphanLessons', label: 'Уроки без курса', count: orphanLessons.length },
        { key: 'orphanWikiArticles', label: 'Wiki-статьи с битой категорией', count: orphanWikiArticles.length, hint: 'categoryId указывает на удалённую категорию' },
        { key: 'orphanPushSubs', label: 'Push-подписки без пользователя', count: orphanPushSubs.length, hint: 'userId указывает на удалённого пользователя' },
        { key: 'orphanFiles', label: 'Осиротевшие файлы', count: orphanFiles.length, hint: 'Файлы в /uploads/ без ссылок в БД' },
    ];

    const totalProblems = categories.reduce((s, c) => s + c.count, 0);

    return {
        checkedAt: new Date().toISOString(),
        categories,
        totalProblems,
        clean: totalProblems === 0,
    };
}

/* ─────────────────────── CLEANUP ─────────────────────── */

async function cleanupOrphanChats() {
    const ids = await findOrphanChats();
    let n = 0;
    for (const id of ids) {
        try {
            await prisma.$transaction((tx) => hardDeleteChat(tx, id));
            n++;
        } catch (e) {
            console.error('[maintenance] chat', id, e.message);
        }
    }
    return n;
}

async function cleanupDuplicateDirectChats() {
    const dups = await findDuplicateDirectChats();
    let n = 0;
    for (const d of dups) {
        for (const id of d.removeIds) {
            try {
                await prisma.$transaction((tx) => hardDeleteChat(tx, id));
                n++;
            } catch (e) {
                console.error('[maintenance] dup chat', id, e.message);
            }
        }
    }
    return n;
}

async function deleteByIds(model, ids) {
    if (!ids.length) return 0;
    const res = await prisma[model].deleteMany({ where: { id: { in: ids } } });
    return res.count;
}

async function cleanupOrphanChatMembers() { return deleteByIds('chatMember', await findOrphanChatMembers()); }
async function cleanupOrphanMessages() { return deleteByIds('message', await findOrphanMessages()); }
async function cleanupOrphanReactions() { return deleteByIds('reaction', await findOrphanReactions()); }
async function cleanupOrphanComments() { return deleteByIds('comment', await findOrphanComments()); }
async function cleanupOrphanPostReactions() { return deleteByIds('postReaction', await findOrphanPostReactions()); }

async function cleanupBadPinnedRefs() {
    const ids = await findBadPinnedRefs();
    if (!ids.length) return 0;
    return (await prisma.chat.updateMany({
        where: { id: { in: ids } },
        data: { pinnedMessageId: null },
    })).count;
}

async function cleanupBadReplyRefs() {
    const ids = await findBadReplyRefs();
    if (!ids.length) return 0;
    return (await prisma.message.updateMany({
        where: { id: { in: ids } },
        data: { replyToId: null },
    })).count;
}

async function cleanupBadCommentParentRefs() {
    const ids = await findBadCommentParentRefs();
    if (!ids.length) return 0;
    return (await prisma.comment.updateMany({
        where: { id: { in: ids } },
        data: { parentId: null },
    })).count;
}

async function cleanupOrphanNotifications() { return deleteByIds('notification', await findOrphanNotifications()); }
async function cleanupOrphanPosts() { return deleteByIds('post', await findOrphanPosts()); }
async function cleanupOrphanEnrollments() { return deleteByIds('enrollment', await findOrphanEnrollments()); }
async function cleanupOrphanLessonProgress() { return deleteByIds('lessonProgress', await findOrphanLessonProgress()); }
async function cleanupOrphanTestAttempts() { return deleteByIds('testAttempt', await findOrphanTestAttempts()); }
async function cleanupOrphanCertificates() { return deleteByIds('certificate', await findOrphanCertificates()); }
async function cleanupOrphanQuestions() { return deleteByIds('question', await findOrphanQuestions()); }
async function cleanupOrphanTests() { return deleteByIds('test', await findOrphanTests()); }
async function cleanupOrphanLessons() { return deleteByIds('lesson', await findOrphanLessons()); }

async function cleanupOrphanWikiArticles() {
    const ids = await findOrphanWikiArticles();
    if (!ids.length) return 0;
    return (await prisma.wikiArticle.updateMany({
        where: { id: { in: ids } },
        data: { categoryId: null },
    })).count;
}

async function cleanupOrphanPushSubs() {
    const ids = await findOrphanPushSubs();
    return deleteByIds('pushSubscription', ids);
}

async function cleanupOrphanFiles() {
    const files = await findOrphanFiles();
    let n = 0;
    for (const f of files) {
        try {
            fs.unlinkSync(path.join(UPLOADS_DIR, f));
            n++;
        } catch (e) {
            console.error('[maintenance] file', f, e.message);
        }
    }
    return n;
}

/* ─────────── Полная очистка ─────────── */

export async function cleanupDatabase() {
    const fixed = {};

    fixed.orphanChats = await cleanupOrphanChats();
    fixed.duplicateDirectChats = await cleanupDuplicateDirectChats();
    fixed.orphanChatMembers = await cleanupOrphanChatMembers();
    fixed.orphanMessages = await cleanupOrphanMessages();
    fixed.orphanReactions = await cleanupOrphanReactions();
    fixed.badPinnedRefs = await cleanupBadPinnedRefs();
    fixed.badReplyRefs = await cleanupBadReplyRefs();
    fixed.orphanComments = await cleanupOrphanComments();
    fixed.badCommentParentRefs = await cleanupBadCommentParentRefs();
    fixed.orphanPostReactions = await cleanupOrphanPostReactions();
    fixed.orphanNotifications = await cleanupOrphanNotifications();
    fixed.orphanPosts = await cleanupOrphanPosts();
    fixed.orphanEnrollments = await cleanupOrphanEnrollments();
    fixed.orphanLessonProgress = await cleanupOrphanLessonProgress();
    fixed.orphanTestAttempts = await cleanupOrphanTestAttempts();
    fixed.orphanCertificates = await cleanupOrphanCertificates();
    fixed.orphanQuestions = await cleanupOrphanQuestions();
    fixed.orphanTests = await cleanupOrphanTests();
    fixed.orphanLessons = await cleanupOrphanLessons();
    fixed.orphanWikiArticles = await cleanupOrphanWikiArticles();
    fixed.orphanPushSubs = await cleanupOrphanPushSubs();
    fixed.orphanFiles = await cleanupOrphanFiles();

    const totalFixed = Object.values(fixed).reduce((s, v) => s + v, 0);
    const scan = await scanDatabase();

    return { fixed, totalFixed, scan };
}