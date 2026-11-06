import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { prisma } from './prisma.js';

let app;
function messaging() {
    if (process.env.MOBILE_PUSH_ENABLED !== 'true') return null;

    const credentialFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!credentialFile && !credentialJson) {
        console.error('[mobile-push] Firebase credentials are not configured');
        return null;
    }

    try {
        if (!app) {
            const raw = credentialFile
                ? readFileSync(credentialFile, 'utf8')
                : credentialJson;
            const credentials = JSON.parse(raw);
            app = getApps()[0] || initializeApp({
                credential: cert(credentials),
            });
        }

        return getMessaging(app);
    } catch (error) {
        console.error(
            '[mobile-push] Firebase initialization failed:',
            error?.code || error?.name || 'unknown'
        );
        return null;
    }
}

function safePath(url) {
    return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
        ? url : '/app';
}

export async function sendMobilePushToUser(userId, payload) {
    const client = messaging();
    if (!client) return { sent: 0, skipped: true };
    const devices = await prisma.mobilePushToken.findMany({ where: { userId } });
    if (!devices.length) return { sent: 0, failed: 0 };
    const url = safePath(payload.url);
    let sent = 0;
    let failed = 0;
    await Promise.all(devices.map(async ({ id, token }) => {
        try {
            await client.send({
                token,
                notification: { title: String(payload.title || 'MEDIA·RAF·RAW'), body: String(payload.body || '') },
                data: { url, tag: String(payload.tag || '') },
                android: { priority: 'high' },
            });
            sent++;
            await prisma.mobilePushToken.update({ where: { id }, data: { lastUsed: new Date() } }).catch(() => {});
        } catch (error) {
            failed++;
            if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(error?.code)) {
                await prisma.mobilePushToken.deleteMany({ where: { id, token } }).catch(() => {});
            } else {
                console.error('[mobile-push] send failed:', error?.code || error?.message);
            }
        }
    }));
    return { sent, failed };
}

/** Broadcast to already registered Android FCM installations.
 * Uses the same Firebase client and token storage as individual mobile push.
 */
export async function sendMobilePushToAll(payload) {
    const client = messaging();
    if (!client) return { sent: 0, failed: 0, skipped: true };
    const devices = await prisma.mobilePushToken.findMany({
        select: { id: true, token: true },
    });
    let sent = 0, failed = 0;
    for (let i = 0; i < devices.length; i += 500) {
        const batch = devices.slice(i, i + 500);
        const response = await client.sendEachForMulticast({
            tokens: batch.map(device => device.token),
            notification: {
                title: String(payload.title || 'MEDIA·RAF·RAW'),
                body: String(payload.body || ''),
            },
            data: { url: safePath(payload.url), tag: String(payload.tag || '') },
            android: { priority: 'high', ttl: 120000 },
        });
        sent += response.successCount;
        failed += response.failureCount;
        await Promise.all(response.responses.map(async (result, index) => {
            const device = batch[index];
            if (result.success) {
                await prisma.mobilePushToken.update({
                    where: { id: device.id },
                    data: { lastUsed: new Date() },
                }).catch(() => {});
                return;
            }
            if (['messaging/registration-token-not-registered',
                'messaging/invalid-registration-token'].includes(result.error?.code)) {
                await prisma.mobilePushToken.deleteMany({
                    where: { id: device.id, token: device.token },
                }).catch(() => {});
            }
        }));
    }
    return { sent, failed, skipped: false };
}
