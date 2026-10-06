import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { validPayload } from './helpers.js';

describe('POST /api/auth/register', () => {
    describe('успешная регистрация', () => {
        it('создаёт пользователя и возвращает токен + user без passwordHash', async () => {
            const payload = validPayload();
            const res = await request(app).post('/api/auth/register').send(payload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(typeof res.body.token).toBe('string');

            expect(res.body.user).toMatchObject({
                firstName: 'Иван',
                lastName: 'Тестов',
                username: payload.username,
                phone: payload.phone,
                role: 'STUDENT',
                direction: 'photo'
            });
            expect(res.body.user).not.toHaveProperty('passwordHash');
            expect(res.body.user).toHaveProperty('id');
        });

        it('нормализует номер телефона из формата 8XXXXXXXXXX', async () => {
            const phone8 = `89${String(Date.now()).slice(-9)}`;
            const expected = '+7' + phone8.slice(1);
            const payload = validPayload({ phone: phone8 });

            const res = await request(app).post('/api/auth/register').send(payload);

            expect(res.status).toBe(200);
            expect(res.body.user.phone).toBe(expected);
        });

        it('нормализует username: убирает @ и приводит к нижнему регистру', async () => {
            const raw = `@TestUser_${Date.now().toString().slice(-4)}`;
            const payload = validPayload({ username: raw });

            const res = await request(app).post('/api/auth/register').send(payload);

            expect(res.status).toBe(200);
            expect(res.body.user.username).toMatch(/^testuser_\d+$/);
        });
    });

    describe('валидация входных данных', () => {
        it('400 если нет firstName', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ firstName: '' }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/имя/i);
        });

        it('400 если нет lastName', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ lastName: '' }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/имя|фамили/i);
        });

        it('400 если пароль короче 6 символов', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ password: '123' }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/пароль/i);
        });

        it('400 если телефон некорректный', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ phone: '123' }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/телефон/i);
        });

        it('400 если username содержит недопустимые символы', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ username: 'кириллица' }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/ник/i);
        });

        it('400 если username слишком короткий', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ username: 'ab' }));

            expect(res.status).toBe(400);
        });
    });

    describe('уникальность', () => {
        it('409 если телефон уже занят', async () => {
            const payload = validPayload();
            const first = await request(app).post('/api/auth/register').send(payload);
            expect(first.status).toBe(200);

            const second = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ phone: payload.phone }));

            expect(second.status).toBe(409);
            expect(second.body.error).toMatch(/телефон/i);
        });

        it('409 если username уже занят', async () => {
            const payload = validPayload();
            const first = await request(app).post('/api/auth/register').send(payload);
            expect(first.status).toBe(200);

            const second = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ username: payload.username }));

            expect(second.status).toBe(409);
            expect(second.body.error).toMatch(/ник/i);
        });
    });

    describe('направление (direction)', () => {
        it('подставляет "photo" при невалидном direction', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validPayload({ direction: 'unknown_value' }));

            expect(res.status).toBe(200);
            expect(res.body.user.direction).toBe('photo');
        });

        it('принимает все допустимые направления', async () => {
            for (const dir of ['photo', 'video', 'radio', 'sound']) {
                const res = await request(app)
                    .post('/api/auth/register')
                    .send(validPayload({ direction: dir }));

                expect(res.status).toBe(200);
                expect(res.body.user.direction).toBe(dir);
            }
        });
    });
});