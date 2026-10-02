/* eslint-disable no-undef */
import {
    precacheAndRoute,
    cleanupOutdatedCaches,
    createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

// Precache-манифест подставит vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);

// Runtime-кэширование
registerRoute(
    ({ url }) => url.pathname.startsWith('/api'),
    new NetworkOnly()
);

registerRoute(
    ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/uploads/'),
    new CacheFirst({
        cacheName: 'uploads-v4',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
    })
);

/* ─────────── SPA-навигация ───────────
   Любой браузерный переход по клиентскому роуту (/, /login, /app/*,
   /verify/*, /wiki/*) должен получать закешированный index.html,
   даже когда сети нет. Без этого на холодном старте PWA без интернета
   браузер покажет свою страницу-заглушку («нет соединения»),
   и пользователь увидит именно её, а не наш OfflineScreen. */
const navHandler = createHandlerBoundToURL('/index.html');
registerRoute(
    new NavigationRoute(navHandler, {
        // /api и /uploads обслуживаются выше; на всякий случай
        // исключаем их и здесь.
        denylist: [/^\/api\//, /^\/uploads\//],
    })
);

/* ─────────── Push-уведомления ─────────── */

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload = {};
    try { payload = event.data.json(); } catch {
        payload = { title: 'MEDIA·RAF·RAW', body: event.data.text() };
    }

    const title = payload.title || 'MEDIA·RAF·RAW';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        tag: payload.tag || `mrr-${Date.now()}`,
        data: { url: payload.url || '/app' },
        vibrate: [80, 40, 80],
        requireInteraction: false,
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/app';
    const absoluteUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Если уже открыт — фокусируем и навигируем
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(absoluteUrl).catch(() => {});
                    return client.focus();
                }
            }
            // Иначе открываем новое окно
            if (clients.openWindow) return clients.openWindow(absoluteUrl);
        })
    );
});

/* ─────────── Поддержка обновления SW ─────────── */

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});