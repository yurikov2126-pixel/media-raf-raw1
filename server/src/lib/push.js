import webpush from 'web-push';
import { prisma } from './prisma.js';

let initialized = false;

function init() {
    if (initialized) return true;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mediarafraw.ru';

    if (!pub || !priv) {
        console.warn('[push] VAPID keys не заданы — push-уведомления отключены');
        return false;
    }

    webpush.setVapidDetails(subject, pub, priv);
    initialized = true;
    return true;
}

export function getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Сохраняет или обновляет подписку для пользователя.
 */
export async function saveSubscription(userId, subscription, userAgent) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        throw new Error('Некорректная подписка');
    }
    return prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: userAgent || null,
            lastUsed: new Date(),
        },
        create: {
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: userAgent || null,
        },
    });
}

export async function removeSubscription(endpoint) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Отправляет пуш-уведомление на один endpoint.
 *
 * При успехе обновляет lastUsed — это критично для автоочистки
 * неактивных подписок: если поле не обновлять, все живые подписки
 * со временем попадут под критерий «неактивна N дней» и удалятся.
 *
 * Возвращает { ok, status } или { ok: false, gone: true } — если подписка мертва.
 */
async function sendToSub(sub, payload) {
    if (process.env.PREVIEW_MODE === 'true') return { ok: false, preview: true };
    try {
        await webpush.sendNotification(
            {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 } // 24 часа
        );

        // Подписка жива — обновляем отметку активности.
        await prisma.pushSubscription
            .update({
                where: { id: sub.id },
                data: { lastUsed: new Date() },
            })
            .catch(() => {});

        return { ok: true };
    } catch (e) {
        const status = e?.statusCode;
        // 404/410 — подписка больше не существует, удаляем
        if (status === 404 || status === 410) {
            await prisma.pushSubscription
                .delete({ where: { id: sub.id } })
                .catch(() => {});
            return { ok: false, gone: true };
        }
        console.error('[push] send error:', status, e?.body || e?.message);
        return { ok: false, status };
    }
}

/**
 * Отправляет пуш всем подпискам пользователя.
 * Возвращает { sent, failed, gone }.
 */
export async function sendPushToUser(userId, payload) {
    if (!init()) return { sent: 0, failed: 0, gone: 0 };

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return { sent: 0, failed: 0, gone: 0 };

    let sent = 0, failed = 0, gone = 0;
    await Promise.all(
        subs.map(async (sub) => {
            const r = await sendToSub(sub, payload);
            if (r.ok) sent++;
            else if (r.gone) gone++;
            else failed++;
        })
    );

    return { sent, failed, gone };
}

/**
 * Отправляет пуш нескольким пользователям (для рассылки).
 */
export async function sendPushToUsers(userIds, payload) {
    if (!init()) return { sent: 0, failed: 0, gone: 0 };

    const subs = await prisma.pushSubscription.findMany({
        where: { userId: { in: userIds } },
    });

    let sent = 0, failed = 0, gone = 0;
    await Promise.all(
        subs.map(async (sub) => {
            const r = await sendToSub(sub, payload);
            if (r.ok) sent++;
            else if (r.gone) gone++;
            else failed++;
        })
    );

    return { sent, failed, gone };
}

/**
 * Отправка всем подписанным (broadcast).
 */
export async function sendPushToAll(payload) {
    if (!init()) return { sent: 0, failed: 0, gone: 0 };

    const subs = await prisma.pushSubscription.findMany();
    let sent = 0, failed = 0, gone = 0;

    // Партиями по 100, чтобы не забить пул
    for (let i = 0; i < subs.length; i += 100) {
        const batch = subs.slice(i, i + 100);
        await Promise.all(
            batch.map(async (sub) => {
                const r = await sendToSub(sub, payload);
                if (r.ok) sent++;
                else if (r.gone) gone++;
                else failed++;
            })
        );
    }

    return { sent, failed, gone };
}