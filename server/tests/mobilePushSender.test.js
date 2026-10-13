import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendMobilePushToUser } from '../src/lib/mobilePush.js';

const originalEnabled = process.env.MOBILE_PUSH_ENABLED;
const originalCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const originalCredentialFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;

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

    if (originalCredentialFile === undefined) {
        delete process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    } else {
        process.env.FIREBASE_SERVICE_ACCOUNT_FILE = originalCredentialFile;
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

    it('безопасно обрабатывает отсутствующий файл Firebase', async () => {
        process.env.MOBILE_PUSH_ENABLED = 'true';
        delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        process.env.FIREBASE_SERVICE_ACCOUNT_FILE =
            '/nonexistent/mediaraf-fcm-service-account.json';

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await sendMobilePushToUser(
            'test-user',
            { title: 'Test', body: 'Message', url: '/app' }
        );

        expect(result).toEqual({ sent: 0, skipped: true });
    });

    it('безопасно обрабатывает некорректный файл Firebase', async () => {
        const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');

        const dir = mkdtempSync(join(tmpdir(), 'mediaraf-fcm-test-'));

        try {
            const file = join(dir, 'firebase.json');
            writeFileSync(file, '{invalid-json', { mode: 0o600 });

            process.env.MOBILE_PUSH_ENABLED = 'true';
            delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            process.env.FIREBASE_SERVICE_ACCOUNT_FILE = file;

            vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await sendMobilePushToUser(
                'test-user',
                { title: 'Test', body: 'Message', url: '/app' }
            );

            expect(result).toEqual({ sent: 0, skipped: true });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('читает корректный Service Account из файла', async () => {
        const { generateKeyPairSync } = await import('node:crypto');
        const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');

        const dir = mkdtempSync(join(tmpdir(), 'mediaraf-fcm-valid-'));

        try {
            const { privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem',
                },
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem',
                },
            });

            const file = join(dir, 'service-account.json');

            writeFileSync(file, JSON.stringify({
                type: 'service_account',
                project_id: 'mediaraf-fcm-local-test',
                private_key: privateKey,
                client_email: 'test@mediaraf-fcm-local-test.iam.gserviceaccount.com',
            }), { mode: 0o600 });

            process.env.MOBILE_PUSH_ENABLED = 'true';
            delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            process.env.FIREBASE_SERVICE_ACCOUNT_FILE = file;

            // Не отправляем уведомления: проверяем только инициализацию.
            // Загружаем отдельный экземпляр модуля, чтобы инициализация
            // Firebase не сохранялась для остальных тестов.
            vi.resetModules();
            const { sendMobilePushToUser: sendFromFile } =
                await import('../src/lib/mobilePush.js');

            const result = await sendFromFile(
                'test-user-without-devices',
                { title: 'Test', body: 'Message', url: '/app' }
            );

            expect(result).toEqual({ sent: 0, failed: 0 });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
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
