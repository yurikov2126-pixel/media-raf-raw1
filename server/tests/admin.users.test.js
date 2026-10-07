import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, makeAdmin } from './helpers.js';

/* ─────────── Локальный композитный хелпер ───────────
 * createUser + makeAdmin из общих helpers.
 * Возвращает то же, что createUser, плюс обновлённую роль в user.
 */
async function createAdmin() {
    const created = await createUser();
    const updated = await makeAdmin(created.user.id);
    return {
        user: { ...created.user, role: updated.role },
        token: created.token,
        payload: created.payload,
    };
}

const API = '/api/admin';

/* ═══════════ GET /api/admin/users ═══════════ */

describe('GET /api/admin/users', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}/users`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/users`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 для админа, возвращает список без passwordHash', async () => {
        const { token } = await createAdmin();
        await createUser();

        const res = await request(app)
            .get(`${API}/users`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);

        for (const u of res.body) {
            expect(u).not.toHaveProperty('passwordHash');
        }
    });
});

/* ═══════════ PATCH /api/admin/users/:id ═══════════ */

describe('PATCH /api/admin/users/:id', () => {
    it('400 при недопустимой роли', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        const res = await request(app)
            .patch(`${API}/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ role: 'SUPERHERO' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/роль/i);
    });

    it('200 — меняет роль STUDENT → MENTOR', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        const res = await request(app)
            .patch(`${API}/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ role: 'MENTOR' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('MENTOR');
        expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('200 — банит пользователя', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        const res = await request(app)
            .patch(`${API}/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ isBanned: true });

        expect(res.status).toBe(200);
        expect(res.body.isBanned).toBe(true);

        const inDb = await prisma.user.findUnique({ where: { id: user.id } });
        expect(inDb.isBanned).toBe(true);
    });

    it('404 на несуществующий id (Prisma P2025 → errorHandler)', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .patch(`${API}/users/00000000-0000-0000-0000-000000000000`)
            .set('Authorization', `Bearer ${token}`)
            .send({ role: 'MENTOR' });

        expect(res.status).toBe(404);
    });
});

/* ═══════════ PATCH /api/admin/users/:id/password ═══════════ */

describe('PATCH /api/admin/users/:id/password', () => {
    it('400 при коротком пароле', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        const res = await request(app)
            .patch(`${API}/users/${user.id}/password`)
            .set('Authorization', `Bearer ${token}`)
            .send({ newPassword: '123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/6 символов/i);
    });

    it('404 на несуществующего пользователя', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .patch(`${API}/users/00000000-0000-0000-0000-000000000000/password`)
            .set('Authorization', `Bearer ${token}`)
            .send({ newPassword: 'newStrongPass123' });

        expect(res.status).toBe(404);
    });

    it('200 — меняет пароль и обновляет passwordChangedAt', async () => {
        const { token } = await createAdmin();
        const { user, payload } = await createUser();

        const before = await prisma.user.findUnique({ where: { id: user.id } });
        const beforeChangedAt = before.passwordChangedAt;

        // Пауза, чтобы passwordChangedAt точно отличался
        await new Promise((r) => setTimeout(r, 20));

        const res = await request(app)
            .patch(`${API}/users/${user.id}/password`)
            .set('Authorization', `Bearer ${token}`)
            .send({ newPassword: 'brandNewPass456' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.fullName).toBe(user.fullName);

        const after = await prisma.user.findUnique({ where: { id: user.id } });
        expect(after.passwordHash).not.toBe(before.passwordHash);
        expect(after.passwordChangedAt).not.toBe(beforeChangedAt);

        // Старый пароль больше не подходит, новый — работает
        const oldLogin = await request(app)
            .post('/api/auth/login')
            .send({ login: user.username, password: payload.password });
        expect(oldLogin.status).toBe(401);

        const newLogin = await request(app)
            .post('/api/auth/login')
            .send({ login: user.username, password: 'brandNewPass456' });
        expect(newLogin.status).toBe(200);
    });
});

/* ═══════════ DELETE /api/admin/users/:id ═══════════ */

describe('DELETE /api/admin/users/:id', () => {
    it('400 — нельзя удалить самого себя', async () => {
        const admin = await createAdmin();

        const res = await request(app)
            .delete(`${API}/users/${admin.user.id}`)
            .set('Authorization', `Bearer ${admin.token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/собственный аккаунт/i);

        // Проверяем, что админ не удалился
        const stillThere = await prisma.user.findUnique({ where: { id: admin.user.id } });
        expect(stillThere).not.toBeNull();
    });

    it('404 на несуществующего пользователя', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .delete(`${API}/users/00000000-0000-0000-0000-000000000000`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it('200 — удаляет пользователя и его данные', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        // Добавим пользователю пост, чтобы проверить каскад
        await prisma.post.create({
            data: { authorId: user.id, content: 'test post before delete' },
        });

        const res = await request(app)
            .delete(`${API}/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const gone = await prisma.user.findUnique({ where: { id: user.id } });
        expect(gone).toBeNull();

        const posts = await prisma.post.findMany({ where: { authorId: user.id } });
        expect(posts).toHaveLength(0);
    });
});