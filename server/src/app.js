import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
import reportsRouter from './routes/reports.js';
import modulesRouter from './routes/modules.js';
import onboardingRouter from './routes/onboarding.js';
import publicMetaRouter from './routes/publicMeta.js';
import gamificationRouter from './routes/gamification.js';
import practicalsRouter from './routes/practicals.js';
import homeworkRouter from './routes/homework.js';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ─────────── CORS ─────────── */
const CLIENT_URL_RAW = process.env.CLIENT_URL || '';
const CLIENT_ORIGINS = CLIENT_URL_RAW
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const corsOptions = {
    origin: CLIENT_ORIGINS.length > 0 ? CLIENT_ORIGINS : true,
    credentials: true
};

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Статика загрузок (фото, видео, файлы, голосовые)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

/* ─────────── Bot-метаданные ─────────── */
app.use(publicMetaRouter);

/* ─────────── Публичные настройки ─────────── */
const PUBLIC_SETTING_KEYS = [
    'site_name',
    'site_description',
    'brand_logo_text',
    'brand_logo_subtitle',
    'brand_accent_1',
    'brand_accent_2',
    'brand_accent_3',
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
    'nav_items',
    'footer_description',
    'footer_copyright',
    'footer_links',
    'certificate_template',
    'certificate_accent_1',
    'certificate_accent_2',
    'certificate_org_name',
    'certificate_subtitle',
    'certificate_signature',
    'contact_email',
    'radio_stream_url',
    'vk_link',
    'tg_link'
];

app.get('/api/settings/public', async (_req, res) => {
    try {
        const rows = await prisma.setting.findMany();
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        res.json(
            Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, map[k] ?? null]))
        );
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
app.use('/api/practicals', practicalsRouter);
app.use('/api/homework', homeworkRouter);

app.get('/api/health', (_req, res) =>
    res.json({ ok: true, service: 'MEDIA-RAF-RAW' })
);

/* ─────────── 404 для API ─────────── */
app.use('/api', (req, res) => {
    res.status(404).json({ error: `Не найдено: ${req.method} ${req.originalUrl}` });
});

/* ─────────── Раздача клиента (SPA) ─────────── */
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
    app.use(
        express.static(CLIENT_DIST, {
            maxAge: '30d',
            immutable: true,
            index: false
        })
    );
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

export { app };