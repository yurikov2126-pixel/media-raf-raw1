import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser } from './helpers.js';

describe('GET /api/auth/me', () => {
    it('200 и данные пользователя с валидным токеном', async () => {
        const { user, token } = await createUser();

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(user.id);
        expect(res.body.username).toBe(user.username);
        expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('401 без токена', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('401 с невалидным токеном', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(res.status).toBe(401);
    });

    it('отклоняет забаненного пользователя (401 или 403)', async () => {
        const { user, token } = await createUser();
        await prisma.user.update({
            where: { id: user.id },
            data: { isBanned: true }
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        // Мидлварь auth может вернуть 401 или 403 — главное, что доступ закрыт
        expect([401, 403]).toContain(res.status);
        expect(res.body).toHaveProperty('error');
    });

    it('обновляет lastSeen', async () => {
        const { user, token } = await createUser();

        await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        await new Promise((r) => setTimeout(r, 150));

        const updated = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updated.lastSeen).not.toBeNull();
    });
});