import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, createPost, createComment, makeAdmin } from './helpers.js';

describe('POST /api/posts/:id/comments', () => {
    it('создаёт комментарий верхнего уровня', async () => {
        const { user, token } = await createUser();
        const post = await createPost(token);

        const res = await request(app)
            .post(`/api/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Первый!' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Первый!');
        expect(res.body.author.id).toBe(user.id);
        expect(res.body.parentId).toBeNull();
        expect(res.body.replies).toEqual([]);
    });

    it('создаёт ответ на комментарий', async () => {
        const { token } = await createUser();
        const post = await createPost(token);
        const parent = await createComment(token, post.id, { content: 'Родитель' });

        const res = await request(app)
            .post(`/api/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Ответ', parentId: parent.id });

        expect(res.status).toBe(200);
        expect(res.body.parentId).toBe(parent.id);
    });

    it('400 на пустой комментарий', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        const res = await request(app)
            .post(`/api/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '   ' });

        expect(res.status).toBe(400);
    });

    it('404 при попытке комментировать несуществующий пост', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post('/api/posts/nope/comments')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'x' });

        expect(res.status).toBe(404);
    });

    it('400 если parentId принадлежит другому посту', async () => {
        const { token } = await createUser();
        const postA = await createPost(token);
        const postB = await createPost(token);
        const commentOnB = await createComment(token, postB.id);

        const res = await request(app)
            .post(`/api/posts/${postA.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Ответ', parentId: commentOnB.id });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/posts/:id/comments', () => {
    it('возвращает дерево комментариев', async () => {
        const { token } = await createUser();
        const post = await createPost(token);
        const root = await createComment(token, post.id, { content: 'Корень' });

        await createComment(token, post.id, { content: 'Ответ 1', parentId: root.id });
        await createComment(token, post.id, { content: 'Ответ 2', parentId: root.id });

        const res = await request(app)
            .get(`/api/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].content).toBe('Корень');
        expect(res.body[0].replies).toHaveLength(2);
    });
});

describe('PATCH /api/posts/comments/:id', () => {
    it('автор редактирует свой комментарий', async () => {
        const { token } = await createUser();
        const post = await createPost(token);
        const comment = await createComment(token, post.id, { content: 'Старый' });

        const res = await request(app)
            .patch(`/api/posts/comments/${comment.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Новый' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Новый');
        expect(res.body.editedAt).not.toBeNull();
    });

    it('403 при редактировании чужого комментария', async () => {
        const { token: t1 } = await createUser();
        const { token: t2 } = await createUser();
        const post = await createPost(t1);
        const comment = await createComment(t1, post.id);

        const res = await request(app)
            .patch(`/api/posts/comments/${comment.id}`)
            .set('Authorization', `Bearer ${t2}`)
            .send({ content: 'Взлом' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/posts/comments/:id', () => {
    it('автор удаляет свой комментарий', async () => {
        const { token } = await createUser();
        const post = await createPost(token);
        const comment = await createComment(token, post.id);

        const res = await request(app)
            .delete(`/api/posts/comments/${comment.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const gone = await prisma.comment.findUnique({ where: { id: comment.id } });
        expect(gone).toBeNull();
    });

    it('403 при удалении чужого комментария', async () => {
        const { token: t1 } = await createUser();
        const { token: t2 } = await createUser();
        const post = await createPost(t1);
        const comment = await createComment(t1, post.id);

        const res = await request(app)
            .delete(`/api/posts/comments/${comment.id}`)
            .set('Authorization', `Bearer ${t2}`);

        expect(res.status).toBe(403);
    });

    it('админ удаляет чужой комментарий', async () => {
        const { token: t1 } = await createUser();
        const { user: admin, token: adminToken } = await createUser();
        await makeAdmin(admin.id);
        const post = await createPost(t1);
        const comment = await createComment(t1, post.id);

        const res = await request(app)
            .delete(`/api/posts/comments/${comment.id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });
});