import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { renderMetaPage, absoluteUrl, getBaseUrl } from '../lib/ogRender.js';

const router = Router();

/* Регулярка совпадений с известными ботами. Если UA не подходит — пропускаем
   запрос дальше (next()), чтобы обычные пользователи получили SPA. */
const BOT_UA = /(bot|crawler|spider|telegram|whatsapp|vkshare|vk\.com|discord|slack|twitterbot|facebookexternalhit|linkedinbot|embedly|pinterest|skype|googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|ia_archiver|preview)/i;

function isBot(req) {
    const ua = req.headers['user-agent'] || '';
    return BOT_UA.test(ua);
}

/* Кэш в памяти. Bot-запросы редки, но горячие ссылки могут часто
   обновляться в чатах — кэш на 5 минут снижает нагрузку на БД. */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
        cache.delete(key);
        return null;
    }
    return item.html;
}

function setCached(key, html) {
    if (cache.size >= CACHE_MAX) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, { html, expires: Date.now() + CACHE_TTL_MS });
}

/* ─── Профиль пользователя ─── */

router.get('/app/u/:username', async (req, res, next) => {
    if (!isBot(req)) return next();
    const { username } = req.params;
    const key = `user:${username}`;
    const cached = getCached(key);
    if (cached) return res.type('html').send(cached);

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                username: true,
                fullName: true,
                bio: true,
                avatar: true,
                direction: true,
                role: true,
                isBanned: true,
            },
        });
        if (!user || user.isBanned) return next();

        const base = getBaseUrl(req);
        const url = `${base}/app/u/${user.username}`;
        const image = absoluteUrl(base, user.avatar);

        const DIR_LABEL = { photo: 'Фото', video: 'Видео', radio: 'Радио', sound: 'Звук' };
        const roleLabel =
            user.role === 'ADMIN' ? 'Администратор' :
                user.role === 'MENTOR' ? 'Ментор' :
                    'Студент';
        const direction = user.direction ? DIR_LABEL[user.direction] || '' : '';

        const description = user.bio
            || `${roleLabel}${direction ? ` · ${direction}` : ''} · Медиацентр MEDIA·RAF·RAW`;

        const html = renderMetaPage({
            url,
            title: `${user.fullName} (@${user.username})`,
            description,
            image,
            type: 'profile',
        });
        setCached(key, html);
        res.type('html').send(html);
    } catch (e) {
        console.error('[publicMeta] user:', e);
        next();
    }
});

/* ─── Сертификат ─── */

router.get('/app/certificates/:id', async (req, res, next) => {
    if (!isBot(req)) return next();
    const { id } = req.params;
    const key = `cert:${id}`;
    const cached = getCached(key);
    if (cached) return res.type('html').send(cached);

    try {
        const cert = await prisma.certificate.findUnique({
            where: { id },
            include: {
                user: { select: { fullName: true, username: true } },
                course: { select: { title: true, cover: true } },
            },
        });
        if (!cert) return next();

        const base = getBaseUrl(req);
        const url = `${base}/app/certificates/${id}`;
        const image = absoluteUrl(base, cert.course?.cover);

        const html = renderMetaPage({
            url,
            title: `🏆 ${cert.title}`,
            description: `${cert.user.fullName} успешно прошёл(ла) курс «${cert.course.title}». Сертификат № ${cert.serial}.`,
            image,
            type: 'article',
        });
        setCached(key, html);
        res.type('html').send(html);
    } catch (e) {
        console.error('[publicMeta] certificate:', e);
        next();
    }
});

/* ─── Публичная проверка сертификата ─── */

router.get('/verify/:serial', async (req, res, next) => {
    if (!isBot(req)) return next();
    const { serial } = req.params;
    const key = `verify:${serial}`;
    const cached = getCached(key);
    if (cached) return res.type('html').send(cached);

    try {
        const cert = await prisma.certificate.findUnique({
            where: { serial },
            include: {
                user: { select: { fullName: true, username: true } },
                course: { select: { title: true, cover: true } },
            },
        });

        const base = getBaseUrl(req);
        const url = `${base}/verify/${serial}`;

        if (!cert) {
            const html = renderMetaPage({
                url,
                title: 'Сертификат не найден',
                description: 'Сертификат с таким серийным номером не существует.',
            });
            setCached(key, html);
            return res.type('html').send(html);
        }

        const image = absoluteUrl(base, cert.course?.cover);
        const html = renderMetaPage({
            url,
            title: `✓ Сертификат ${cert.serial}`,
            description: `${cert.user.fullName} — курс «${cert.course.title}». Выдан ${new Date(cert.issuedAt).toLocaleDateString('ru-RU')}.`,
            image,
            type: 'article',
        });
        setCached(key, html);
        res.type('html').send(html);
    } catch (e) {
        console.error('[publicMeta] verify:', e);
        next();
    }
});

/* ─── Wiki-статья ─── */

router.get('/app/wiki/:slug', async (req, res, next) => {
    if (!isBot(req)) return next();
    const { slug } = req.params;
    const key = `wiki:${slug}`;
    const cached = getCached(key);
    if (cached) return res.type('html').send(cached);

    try {
        const article = await prisma.wikiArticle.findUnique({
            where: { slug },
            include: {
                category: { select: { title: true, icon: true } },
            },
        });
        if (!article || !article.published) return next();

        const base = getBaseUrl(req);
        const url = `${base}/app/wiki/${article.slug}`;
        const image = absoluteUrl(base, article.cover);

        const html = renderMetaPage({
            url,
            title: article.title,
            description: article.excerpt || 'Статья из базы знаний MEDIA·RAF·RAW',
            image,
            type: 'article',
        });
        setCached(key, html);
        res.type('html').send(html);
    } catch (e) {
        console.error('[publicMeta] wiki:', e);
        next();
    }
});

/* ─── Курс ─── */

router.get('/app/courses/:slug', async (req, res, next) => {
    if (!isBot(req)) return next();
    const { slug } = req.params;
    const key = `course:${slug}`;
    const cached = getCached(key);
    if (cached) return res.type('html').send(cached);

    try {
        const course = await prisma.course.findUnique({
            where: { slug },
            select: {
                title: true, description: true, cover: true,
                published: true, level: true, category: true, slug: true,
            },
        });
        if (!course || !course.published) return next();

        const base = getBaseUrl(req);
        const url = `${base}/app/courses/${course.slug}`;
        const image = absoluteUrl(base, course.cover);

        const html = renderMetaPage({
            url,
            title: `🎓 ${course.title}`,
            description: course.description || 'Курс медиацентра MEDIA·RAF·RAW',
            image,
            type: 'article',
        });
        setCached(key, html);
        res.type('html').send(html);
    } catch (e) {
        console.error('[publicMeta] course:', e);
        next();
    }
});

export default router;