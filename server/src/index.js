import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chats.js';
import courseRoutes from './routes/courses.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';
import notificationRoutes from './routes/notifications.js';
import postRoutes from './routes/posts.js';
import publicRoutes from './routes/public.js';
import pushRoutes from './routes/push.js';
import wikiRoutes from './routes/wiki.js';
import { initSocket } from './socket.js';
import { setIo } from './lib/notify.js';
import { startCron } from './lib/cron.js';
import { schedulePushCleanup } from './lib/pushCleanupCron.js';
import { prisma } from './lib/prisma.js';
import reportsRouter from './routes/reports.js';
import { scheduleNotifyCleanup } from './lib/notifyCleanupCron.js';
import modulesRouter from './routes/modules.js';
import onboardingRouter from './routes/onboarding.js';
import publicMetaRouter from './routes/publicMeta.js';
import { schedulePasswordResetCleanup } from './lib/passwordResetCron.js';
import gamificationRouter from './routes/gamification.js';
import { scheduleInactivityCharge } from './lib/gamificationCron.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ─────────── CORS ─────────── */
// CLIENT_URL может быть как один домен, так и список через запятую.
// Если не задан — разрешаем все origin'ы (dev-режим).
const CLIENT_URL_RAW = process.env.CLIENT_URL || '';
const CLIENT_ORIGINS = CLIENT_URL_RAW
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const corsOptions = {
    origin: CLIENT_ORIGINS.length > 0 ? CLIENT_ORIGINS : true,
    credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
setIo(io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Статика загрузок (фото, видео, файлы, голосовые)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

/* ─────────── Bot-метаданные ───────────
   Этот middleware перехватывает запросы к /app/u/:username,
   /app/certificates/:id, /verify/:serial, /app/wiki/:slug,
   /app/courses/:slug ТОЛЬКО если User-Agent похож на бота
   (Telegram, VK, WhatsApp и др.). Отдаёт HTML с og-тегами.
   Для обычных пользователей пропускает дальше (next()),
   и они получают обычный SPA.

   ВАЖНО: должен идти ДО express.static('client/dist') и ДО SPA-fallback. */
app.use(publicMetaRouter);

/* ─────────── Публичные настройки ─────────── */
const PUBLIC_SETTING_KEYS = [
    // Брендинг
    'site_name',
    'site_description',
    'brand_logo_text',
    'brand_logo_subtitle',
    'brand_accent_1',
    'brand_accent_2',
    'brand_accent_3',

    // Лендинг
    'landing_hero_badge',
    'landing_hero_title_prefix',
    'landing_hero_title_accent',
    'landing_hero_title_suffix',
    'landing_hero_subtitle',
    'landing_hero_cta_primary',
    'landing_hero_cta_secondary',
    'landing_features_title',
    'landing_features',
    'landing_cta_title',
    'landing_cta_subtitle',
    'landing_cta_button',

    // Меню
    'nav_items',

    // Футер
    'footer_description',
    'footer_copyright',
    'footer_links',

    // Сертификаты
    'certificate_template',
    'certificate_accent_1',
    'certificate_accent_2',
    'certificate_org_name',
    'certificate_subtitle',
    'certificate_signature',

    // Контакты
    'contact_email',
    'radio_stream_url',
    'vk_link',
    'tg_link',
];

app.get('/api/settings/public', async (_req, res) => {
    try {
        const rows = await prisma.setting.findMany();
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        res.json(Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, map[k] ?? null])));
    } catch (e) {
        console.error('[settings/public]', e);
        res.status(500).json({ error: 'Не удалось получить настройки' });
    }
});

/* ─────────── API-роуты ─────────── */
app.use('/api/reports', reportsRouter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/modules', modulesRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/gamification', gamificationRouter);

app.get('/api/health', (_req, res) =>
    res.json({ ok: true, service: 'MEDIA-RAF-RAW' })
);

/* ─────────── 404 для API ───────────
   Если запрос к /api/... не совпал ни с одним роутом — вернём JSON,
   а не HTML. Иначе клиент получит "Cannot GET /api/..." с кодом 404,
   но в виде HTML-страницы, что ломает парсинг. */
app.use('/api', (req, res) => {
    res.status(404).json({ error: `Не найдено: ${req.method} ${req.originalUrl}` });
});

/* ─────────── Раздача клиента (SPA) ───────────
   Express отдаёт собранный клиент из client/dist.
   Это нужно, чтобы:
   - SPA-fallback работал (для клиентских роутов типа /app/u/xxx)
   - publicMetaRouter мог пропустить не-ботов дальше, и они получили index.html
   Если у вас клиент раздаёт nginx напрямую и он до сюда не доходит —
   этот блок просто не будет срабатывать, что нормально. */
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
    // Хэшированные ассеты — надолго
    app.use(
        express.static(CLIENT_DIST, {
            maxAge: '30d',
            immutable: true,
            index: false,
        })
    );
    // Любой другой GET (кроме /api и /uploads) отдаёт index.html —
    // React Router дальше разберётся сам.
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }
        res.sendFile(INDEX_HTML);
    });
    console.log(`📦 Клиент раздаётся из ${CLIENT_DIST}`);
} else {
    console.warn(`⚠️  ${INDEX_HTML} не найден — клиент, вероятно, раздаётся через nginx`);
}

/* ─────────── Обработчики ошибок ─────────── */
process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[process] uncaughtException:', err);
});

/* ─────────── Запуск ─────────── */
initSocket(io);
startCron();
schedulePushCleanup();
scheduleNotifyCleanup();
schedulePasswordResetCleanup();
scheduleInactivityCharge();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
    console.log(`🚀 MEDIA-RAF-RAW API на http://localhost:${PORT}`)
);