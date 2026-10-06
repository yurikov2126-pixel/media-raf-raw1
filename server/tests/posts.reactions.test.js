import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createUser, createPost } from './helpers.js';

describe('POST /api/posts/:id/reactions', () => {
    it('ставит реакцию и возвращает её в списке', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        const res = await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '🔥' });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('added');
        expect(res.body.reactions).toHaveLength(1);
        expect(res.body.reactions[0].emoji).toBe('🔥');
        expect(res.body.my).toEqual(['🔥']);
    });

    it('повторный клик по той же эмодзи удаляет реакцию (toggle)', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '👍' });

        const res = await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '👍' });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('removed');
        expect(res.body.reactions).toHaveLength(0);
        expect(res.body.my).toEqual([]);
    });

    it('разные эмодзи живут отдельно', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '👍' });

        const res = await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '❤️' });

        expect(res.status).toBe(200);
        expect(res.body.reactions).toHaveLength(2);
        const emojis = res.body.reactions.map((r) => r.emoji).sort();
        expect(emojis).toEqual(['❤️', '👍'].sort());
    });

    it('400 без emoji', async () => {
        const { token } = await createUser();
        const post = await createPost(token);

        const res = await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it('404 на несуществующий пост', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post('/api/posts/nope/reactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '👍' });

        expect(res.status).toBe(404);
    });
});

describe('GET /api/posts/:id/reactions', () => {
    it('возвращает агрегированные реакции', async () => {
        const { token: t1 } = await createUser();
        const { token: t2 } = await createUser();
        const post = await createPost(t1);

        await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${t1}`)
            .send({ emoji: '🔥' });

        await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${t2}`)
            .send({ emoji: '🔥' });

        const res = await request(app)
            .get(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${t1}`);

        expect(res.status).toBe(200);
        expect(res.body.reactions).toHaveLength(1);
        expect(res.body.reactions[0].count).toBe(2);
        expect(res.body.my).toEqual(['🔥']);
    });
});