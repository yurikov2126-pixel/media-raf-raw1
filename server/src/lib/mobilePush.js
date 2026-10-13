import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma.js';

let app;
function messaging() {
    if (process.env.MOBILE_PUSH_ENABLED !== 'true') return null;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        console.error('[mobile-push] Firebase credentials are not configured');
        return null;
    }

    try {
        if (!app) {
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
