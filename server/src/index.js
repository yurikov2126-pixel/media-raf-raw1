import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
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
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
});
setIo(io);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

/* ─────────── Роуты ─────────── */
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

app.get('/api/health', (_req, res) =>
    res.json({ ok: true, service: 'MEDIA-RAF-RAW' })
);

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

server.listen(process.env.PORT || 4000, () =>
    console.log(`🚀 MEDIA-RAF-RAW API на http://localhost:${process.env.PORT || 4000}`)
);