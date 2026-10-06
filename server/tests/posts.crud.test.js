import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, createPost, makeAdmin } from './helpers.js';

describe('POST /api/posts', () => {
    it('401 без токена', async () => {
        const res = await request(app).post('/api/posts').send({ content: 'x' });
        expect(res.status).toBe(401);
    });

    it('создаёт пост с текстом', async () => {
        const { user, token } = await createUser();

        const res = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Привет, медиацентр!' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Привет, медиацентр!');
        expect(res.body.authorId).toBe(user.id);
        expect(res.body.id).toBeTruthy();
    });

    it('создаёт пост только с медиа', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({ mediaUrl: '/uploads/test.jpg', mediaType: 'image' });

        expect(res.status).toBe(200);
        expect(res.body.mediaUrl).toBe('/uploads/test.jpg');
        expect(res.body.mediaType).toBe('image');
    });

    it('400 на пустой пост', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '   ' });

        expect(res.status).toBe(400);
    });
});

describe('PATCH /api/posts/:id', () => {
    it('автор редактирует свой пост и ставит editedAt', async () => {
        const { token } = await createUser();
        const post = await createPost(token, { content: 'Старый' });

        const res = await request(app)
            .patch(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Новый' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Новый');
        expect(res.body.editedAt).not.toBeNull();
    });

    it('403 при попытке редактировать чужой пост', async () => {
        const { token: authorToken } = await createUser();
        const { token: otherToken } = await createUser();
        const post = await createPost(authorToken, { content: 'Чужой' });

        const res = await request(app)
            .patch(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${otherToken}`)
            .send({ content: 'Взлом' });

        expect(res.status).toBe(403);
    });

    it('админ может редактировать любой пост', async () => {
        const { token: authorToken } = await createUser();
        const { user: admin, token: adminToken } = await createUser();
        await makeAdmin(admin.id);

        const post = await createPost(authorToken, { content: 'Оригинал' });

        const res = await request(app)
            .patch(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ content: 'Правка админа' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Правка админа');
    });

    it('404 на несуществующий пост', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .patch('/api/posts/nope-nope-nope')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'x' });

        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/posts/:id', () => {
    it('автор удаляет свой пост', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        const res = await request(app)
            .delete(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });

        const gone = await prisma.post.findUnique({ where: { id: post.id } });
        expect(gone).toBeNull();
    });

    it('403 при удалении чужого поста', async () => {
        const { token: authorToken } = await createUser();
        const { token: otherToken } = await createUser();
        const post = await createPost(authorToken);

        const res = await request(app)
            .delete(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
    });

    it('админ удаляет чужой пост', async () => {
        const { token: authorToken } = await createUser();
        const { user: admin, token: adminToken } = await createUser();
        await makeAdmin(admin.id);

        const post = await createPost(authorToken);

        const res = await request(app)
            .delete(`/api/posts/${post.id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });

    it('404 на несуществующий пост', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .delete('/api/posts/nope-nope-nope')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});