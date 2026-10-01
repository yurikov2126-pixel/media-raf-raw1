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
            registerType: 'autoUpdate',
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
                start_url: '/',
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
                    {
                        // maskable — Android, иконка с запасом под обрезку
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
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
});