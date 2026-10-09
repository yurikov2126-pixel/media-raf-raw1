import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            registerType: 'prompt',
            includeAssets: [
                'favicon.svg',
                'favicon-32.png',
                'favicon-16.png',
                'apple-touch-icon.png',
                'icon-192.png',
                'icon-512.png',
                'icon-maskable.svg',
            ],
            manifest: {
                name: 'MEDIA-RAF-RAW',
                short_name: 'MEDIA-RAF-RAW',
                description: 'Студенческий медиацентр · Radio Политех-FM',
                theme_color: '#7C3AED',
                background_color: '#08080F',
                display: 'standalone',
                orientation: 'portrait',
                // PWA всегда открывается сразу в защищённой части.
                // Если пользователь не авторизован — Private из App.jsx
                // сам редиректнет его на /login.
                start_url: '/app',
                scope: '/',
                lang: 'ru',
                icons: [
                    {
                        src: 'icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    // Maskable — отдельный ресурс с safe zone 20 %.
                    // Раньше maskable-иконкой служил icon-512.png, из-за чего
                    // Android обрезал логотип по краям.
                    {
                        src: 'icon-maskable.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'maskable',
                    },
                ],
            },
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
            },
            devOptions: { enabled: false },
        }),
    ],
    server: { port: 5173 },
    test: { environment: 'jsdom', globals: true },
});