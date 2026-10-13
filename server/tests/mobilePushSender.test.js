import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendMobilePushToUser } from '../src/lib/mobilePush.js';

const originalEnabled = process.env.MOBILE_PUSH_ENABLED;
const originalCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

afterEach(() => {
    if (originalEnabled === undefined) {
        delete process.env.MOBILE_PUSH_ENABLED;
    } else {
        process.env.MOBILE_PUSH_ENABLED = originalEnabled;
    }

    if (originalCredentials === undefined) {
        delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    } else {
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalCredentials;
    }

    vi.restoreAllMocks();
});

describe('Android FCM sender safety', () => {
    it('не отправляет уведомления, когда FCM выключен', async () => {
        process.env.MOBILE_PUSH_ENABLED = 'false';

        const result = await sendMobilePushToUser(
            'test-user',
            { title: 'Test', body: 'Message', url: '/app' }
        );

        expect(result).toEqual({ sent: 0, skipped: true });
    });

    it('безопасно пропускает отправку без Firebase credentials', async () => {
        process.env.MOBILE_PUSH_ENABLED = 'true';
        delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await sendMobilePushToUser(
            'test-user',
            { title: 'Test', body: 'Message', url: '/app' }
        );

        expect(result).toEqual({ sent: 0, skipped: true });
    });

    it('не падает при некорректном JSON сервисного аккаунта', async () => {
        process.env.MOBILE_PUSH_ENABLED = 'true';
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{invalid-json';

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await sendMobilePushToUser(
            'test-user',
            { title: 'Test', body: 'Message', url: '/app' }
        );

        expect(result).toEqual({ sent: 0, skipped: true });
    });
});
