/* Генерация HTML-страницы с og-тегами для ботов.
   Боты (Telegram, VK, WhatsApp, Twitter, Discord) не выполняют JS,
   поэтому им нужен отдельный, статический ответ. */

const escapeHtml = (s) =>
    String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export function renderMetaPage({
                                   url,
                                   title,
                                   description,
                                   image,
                                   type = 'website',
                                   siteName = 'MEDIA·RAF·RAW',
                               }) {
    const safeTitle = escapeHtml(title || siteName);
    const safeDesc = escapeHtml(description || 'Платформа студенческого медиацентра');
    const safeImage = image ? escapeHtml(image) : '';
    const safeUrl = escapeHtml(url || '');
    const safeSite = escapeHtml(siteName);
    const safeType = escapeHtml(type);

    return `<!doctype html>
<html lang="ru">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <meta property="og:type" content="${safeType}" />
    <meta property="og:site_name" content="${safeSite}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safeUrl}" />
    ${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ''}
    ${safeImage ? `<meta property="og:image:width" content="1200" />` : ''}
    ${safeImage ? `<meta property="og:image:height" content="630" />` : ''}

    <meta name="twitter:card" content="${safeImage ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    ${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ''}

    <meta http-equiv="refresh" content="0; url=${safeUrl}" />
</head>
<body>
    <p style="font-family: system-ui; padding: 20px; color: #333;">
        Перенаправляем на <a href="${safeUrl}">${safeTitle}</a>…
    </p>
    <script>window.location.replace(${JSON.stringify(url)});</script>
</body>
</html>`;
}

/* Утилита: отдаёт абсолютный URL для относительного пути (типа /uploads/xxx.jpg) */
export function absoluteUrl(base, pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (pathOrUrl.startsWith('//')) return `https:${pathOrUrl}`;
    return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/* Определение базового URL с учётом прокси */
export function getBaseUrl(req) {
    if (process.env.PUBLIC_URL) {
        return process.env.PUBLIC_URL.replace(/\/+$/, '');
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
    return `${proto}://${host}`;
}