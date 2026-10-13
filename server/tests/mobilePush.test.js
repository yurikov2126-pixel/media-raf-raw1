import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser } from './helpers.js';

const endpoint = '/api/mobile-push';

function deviceToken() {
    return `fcm-test-${randomUUID()}-${randomUUID()}`;
}

describe('Android FCM token API', () => {
    it('отклоняет регистрацию без авторизации', async () => {
        const res = await request(app)
            .post(`${endpoint}/register`)
            .send({ token: deviceToken() });

        expect(res.status).toBe(401);
    });

    it('отклоняет слишком короткий токен', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post(`${endpoint}/register`)
            .set('Authorization', `Bearer ${token}`)
            .send({ token: 'short' });

        expect(res.status).toBe(400);
    });

    it('регистрирует токен за авторизованным пользователем', async () => {
        const { user, token } = await createUser();
        const fcmToken = deviceToken();

        const res = await request(app)
            .post(`${endpoint}/register`)
            .set('Authorization', `Bearer ${token}`)
            .send({ token: fcmToken });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const saved = await prisma.mobilePushToken.findUnique({
            where: { token: fcmToken },
        });

        expect(saved.userId).toBe(user.id);
        expect(saved.platform).toBe('android');
    });

    it('не создаёт дубликат при повторной регистрации', async () => {
        const { user, token } = await createUser();
        const fcmToken = deviceToken();

        for (let i = 0; i < 2; i++) {
            const res = await request(app)
                .post(`${endpoint}/register`)
                .set('Authorization', `Bearer ${token}`)
                .send({ token: fcmToken });

            expect(res.status).toBe(200);
        }

        const devices = await prisma.mobilePushToken.findMany({
            where: { userId: user.id, token: fcmToken },
        });

        expect(devices).toHaveLength(1);
    });

    it('передаёт токен новому пользователю при смене аккаунта', async () => {
        const first = await createUser();
        const second = await createUser();
        const fcmToken = deviceToken();

        for (const account of [first, second]) {
            const res = await request(app)
                .post(`${endpoint}/register`)
                .set('Authorization', `Bearer ${account.token}`)
                .send({ token: fcmToken });

            expect(res.status).toBe(200);
        }

        const saved = await prisma.mobilePushToken.findUnique({
            where: { token: fcmToken },
        });

        expect(saved.userId).toBe(second.user.id);

        const oldAccountRes = await request(app)
            .post(`${endpoint}/unregister`)
            .set('Authorization', `Bearer ${first.token}`)
            .send({ token: fcmToken });

        expect(oldAccountRes.status).toBe(200);

        const stillSaved = await prisma.mobilePushToken.findUnique({
            where: { token: fcmToken },
        });

        expect(stillSaved.userId).toBe(second.user.id);
    });

    it('удаляет собственный токен при выходе', async () => {
        const { token } = await createUser();
        const fcmToken = deviceToken();

        await request(app)
            .post(`${endpoint}/register`)
            .set('Authorization', `Bearer ${token}`)
            .send({ token: fcmToken });

        const res = await request(app)
            .post(`${endpoint}/unregister`)
            .set('Authorization', `Bearer ${token}`)
            .send({ token: fcmToken });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const saved = await prisma.mobilePushToken.findUnique({
            where: { token: fcmToken },
        });

        expect(saved).toBeNull();
    });
});
