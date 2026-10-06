import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser } from './helpers.js';

describe('POST /api/auth/login', () => {
    describe('успешный вход', () => {
        it('по username', async () => {
            const { user, payload } = await createUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: user.username, password: payload.password });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.id).toBe(user.id);
            expect(res.body.user).not.toHaveProperty('passwordHash');
        });

        it('по телефону', async () => {
            const { user, payload } = await createUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: user.phone, password: payload.password });

            expect(res.status).toBe(200);
            expect(res.body.user.id).toBe(user.id);
        });

        it('по телефону в формате 8XXXXXXXXXX', async () => {
            const { user, payload } = await createUser();
            const phone8 = '8' + user.phone.slice(2);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: phone8, password: payload.password });

            expect(res.status).toBe(200);
            expect(res.body.user.id).toBe(user.id);
        });

        it('по email', async () => {
            const { user, payload } = await createUser();
            await prisma.user.update({
                where: { id: user.id },
                data: { email: 'testuser@example.com' }
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: 'testuser@example.com', password: payload.password });

            expect(res.status).toBe(200);
            expect(res.body.user.id).toBe(user.id);
        });

        it('по username с префиксом @', async () => {
            const { user, payload } = await createUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: `@${user.username}`, password: payload.password });

            expect(res.status).toBe(200);
        });

        it('по username с заглавными буквами (регистронезависимо)', async () => {
            const { user, payload } = await createUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: user.username.toUpperCase(), password: payload.password });

            expect(res.status).toBe(200);
        });

        it('обновляет lastSeen после успешного входа', async () => {
            const { user, payload } = await createUser();

            await request(app)
                .post('/api/auth/login')
                .send({ login: user.username, password: payload.password });

            const updated = await prisma.user.findUnique({ where: { id: user.id } });
            expect(updated.lastSeen).not.toBeNull();
        });
    });

    describe('валидация', () => {
        it('400 если нет login', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'strongPass123' });

            expect(res.status).toBe(400);
        });

        it('400 если нет password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: 'someone' });

            expect(res.status).toBe(400);
        });

        it('400 если login — пустая строка', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: '   ', password: 'strongPass123' });

            expect(res.status).toBe(400);
        });
    });

    describe('ошибки авторизации', () => {
        it('401 если пользователь не существует', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: 'no_such_user_xyz', password: 'strongPass123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/неверный логин/i);
        });

        it('401 если пароль неверный', async () => {
            const { user } = await createUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: user.username, password: 'wrong_password' });

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/неверный логин/i);
        });

        it('403 если пользователь забанен', async () => {
            const { user, payload } = await createUser();
            await prisma.user.update({
                where: { id: user.id },
                data: { isBanned: true }
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ login: user.username, password: payload.password });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/заблокирован/i);
        });
    });
});