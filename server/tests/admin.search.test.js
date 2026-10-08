import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, makeAdmin, createPost } from './helpers.js';

const API = '/api/admin/search';

async function createAdmin() {
    const created = await createUser();
    await makeAdmin(created.user.id);
    return { user: created.user, token: created.token };
}

describe('GET /api/admin/search', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}?q=test`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}?q=test`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 — короткий запрос возвращает пустые массивы', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}?q=a`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([]);
        expect(res.body.courses).toEqual([]);
        expect(res.body.posts).toEqual([]);
        expect(res.body.certificates).toEqual([]);
        expect(res.body.wiki).toEqual([]);
    });

    it('200 — находит пользователя по части fullName', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();

        // Register вычисляет fullName из firstName+lastName, поэтому
        // задаём его напрямую через prisma — иначе тест зависит от поведения API.
        const marker = `УникальныйПоиск${Date.now()}`;
        await prisma.user.update({
            where: { id: user.id },
            data: { fullName: `${marker} Иванов` },
        });

        const res = await request(app)
            .get(`${API}?q=${encodeURIComponent(marker)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const found = res.body.users.find((u) => u.id === user.id);
        expect(found).toBeTruthy();
        expect(found.username).toBe(user.username);
    });

    it('200 — находит пользователя по username', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();
        const fragment = user.username.slice(0, 8);

        const res = await request(app)
            .get(`${API}?q=${fragment}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.users.find((u) => u.id === user.id)).toBeTruthy();
    });

    it('200 — находит пост по тексту', async () => {
        const { token } = await createAdmin();
        const { token: authorToken, user: author } = await createUser();

        const marker = `УникальноеСлово${Date.now()}`;
        await createPost(authorToken, { content: `${marker} в тексте поста` });

        const res = await request(app)
            .get(`${API}?q=${marker}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.posts.length).toBeGreaterThan(0);
        const found = res.body.posts.find((p) => p.author.id === author.id);
        expect(found).toBeTruthy();
        expect(found.excerpt).toContain(marker);
    });

    it('200 — находит курс по title', async () => {
        const { token } = await createAdmin();
        const marker = `УникальныйКурс${Date.now()}`;
        const course = await prisma.course.create({
            data: {
                slug: `search-test-${Date.now()}`,
                title: `${marker} для поиска`,
                description: '',
                category: 'photo',
            },
        });

        const res = await request(app)
            .get(`${API}?q=${encodeURIComponent(marker)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.courses.find((c) => c.id === course.id)).toBeTruthy();
    });

    it('200 — находит сертификат по serial', async () => {
        const { token } = await createAdmin();
        const { user } = await createUser();
        const course = await prisma.course.create({
            data: {
                slug: `cert-test-${Date.now()}`,
                title: 'Курс для сертификата',
                description: '',
                category: 'photo',
            },
        });
        const serial = `MRR-TEST-${Date.now()}`;
        const cert = await prisma.certificate.create({
            data: {
                serial,
                userId: user.id,
                courseId: course.id,
                title: 'Тестовый сертификат',
            },
        });

        const res = await request(app)
            .get(`${API}?q=${encodeURIComponent(serial)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.certificates.find((c) => c.id === cert.id)).toBeTruthy();
    });

    it('200 — находит wiki-статью по title', async () => {
        const { token } = await createAdmin();
        const marker = `УникальнаяСтатья${Date.now()}`;
        const article = await prisma.wikiArticle.create({
            data: {
                slug: `wiki-test-${Date.now()}`,
                title: `${marker} вики`,
                content: 'Содержание',
                published: true,
            },
        });

        const res = await request(app)
            .get(`${API}?q=${encodeURIComponent(marker)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.wiki.find((w) => w.id === article.id)).toBeTruthy();
    });

    it('200 — лимит 5 на секцию', async () => {
        const { token } = await createAdmin();
        const marker = `ЛимитПоиск${Date.now()}`;

        // Создаём 7 юзеров и явно прописываем им fullName с общим префиксом.
        for (let i = 0; i < 7; i++) {
            const { user } = await createUser();
            await prisma.user.update({
                where: { id: user.id },
                data: { fullName: `${marker} Студент${i}` },
            });
        }

        const res = await request(app)
            .get(`${API}?q=${encodeURIComponent(marker)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.users.length).toBeLessThanOrEqual(5);
    });
});