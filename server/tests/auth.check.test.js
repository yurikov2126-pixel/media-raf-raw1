import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { validPayload, createUser } from './helpers.js';

describe('GET /api/auth/check-username', () => {
    it('возвращает available: true для свободного username', async () => {
        const free = `free_${Date.now().toString().slice(-6)}`;

        const res = await request(app).get('/api/auth/check-username').query({ u: free });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: true });
    });

    it('возвращает available: false для занятого username', async () => {
        const { user } = await createUser();

        const res = await request(app)
            .get('/api/auth/check-username')
            .query({ u: user.username });

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });

    it('reason: "too-short" для короткого username', async () => {
        const res = await request(app).get('/api/auth/check-username').query({ u: 'ab' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: false, reason: 'too-short' });
    });

    it('reason: "invalid-format" для недопустимых символов', async () => {
        const res = await request(app)
            .get('/api/auth/check-username')
            .query({ u: 'кириллица' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: false, reason: 'invalid-format' });
    });

    it('убирает @ и приводит к нижнему регистру при проверке', async () => {
        const { user } = await createUser();

        const res = await request(app)
            .get('/api/auth/check-username')
            .query({ u: `@${user.username.toUpperCase()}` });

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });
});

describe('GET /api/auth/check-phone', () => {
    it('возвращает available: true для свободного телефона', async () => {
        const free = '+79991112233';

        const res = await request(app).get('/api/auth/check-phone').query({ p: free });

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
    });

    it('возвращает available: false для занятого телефона', async () => {
        const { user } = await createUser();

        const res = await request(app)
            .get('/api/auth/check-phone')
            .query({ p: user.phone });

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });

    it('reason: "invalid" для некорректного телефона', async () => {
        const res = await request(app).get('/api/auth/check-phone').query({ p: '123' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: false, reason: 'invalid' });
    });
});