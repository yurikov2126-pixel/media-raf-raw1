import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, createPost, makeAdmin } from './helpers.js';

// Хелпер: оставляем только посты, авторы которых созданы нашими тестовыми юзерами
function onlyTestPosts(items) {
    return items.filter(
        (p) =>
            p.author.username.startsWith('test_') ||
            (p.author.phone && p.author.phone.startsWith('+7999'))
    );
}

describe('GET /api/posts/feed', () => {
    it('401 без токена', async () => {
        const res = await request(app).get('/api/posts/feed');
        expect(res.status).toBe(401);
    });

    it('не возвращает постов, созданных тестовыми юзерами, если их нет', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get('/api/posts/feed')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(onlyTestPosts(res.body.items)).toEqual([]);
    });

    it('возвращает свои посты в порядке от новых к старым', async () => {
        const { user, token } = await createUser();

        await createPost(token, { content: 'Первый' });
        await new Promise((r) => setTimeout(r, 20));
        await createPost(token, { content: 'Второй' });
        await new Promise((r) => setTimeout(r, 20));
        await createPost(token, { content: 'Третий' });

        const res = await request(app)
            .get('/api/posts/feed')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const mine = onlyTestPosts(res.body.items).filter((p) => p.author.id === user.id);
        expect(mine.length).toBe(3);
        expect(mine[0].content).toBe('Третий');
        expect(mine[1].content).toBe('Второй');
        expect(mine[2].content).toBe('Первый');
    });

    it('не показывает посты забаненных авторов', async () => {
        const { user: banned, token: bannedToken } = await createUser();
        const { token } = await createUser();

        const post = await createPost(bannedToken, { content: 'От забаненного' });

        await prisma.user.update({
            where: { id: banned.id },
            data: { isBanned: true }
        });

        const res = await request(app)
            .get('/api/posts/feed')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items.find((p) => p.id === post.id)).toBeUndefined();
    });

    it('уважает limit', async () => {
        const { token } = await createUser();

        for (let i = 0; i < 5; i++) {
            await createPost(token, { content: `Пост ${i}` });
            await new Promise((r) => setTimeout(r, 10));
        }

        const res = await request(app)
            .get('/api/posts/feed?limit=2')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(2);
        expect(res.body.nextCursor).not.toBeNull();
    });

    it('пагинация через cursor возвращает все посты без потерь', async () => {
        const { user, token } = await createUser();

        for (let i = 0; i < 5; i++) {
            await createPost(token, { content: `Пост ${i}` });
            await new Promise((r) => setTimeout(r, 10));
        }

        // Собираем все страницы
        const collected = [];
        let cursor = null;
        let guard = 0;

        while (guard < 20) {
            const url = `/api/posts/feed?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
            const res = await request(app)
                .get(url)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);

            // Собираем только наши посты
            const mine = res.body.items.filter((p) => p.author.id === user.id);
            collected.push(...mine.map((p) => p.content));

            if (!res.body.nextCursor) break;
            cursor = res.body.nextCursor;
            guard++;
        }

        expect(collected.length).toBe(5);
        const uniq = new Set(collected);
        expect(uniq.size).toBe(5);
        // Проверяем, что пришли все наши посты
        const expected = ['Пост 0', 'Пост 1', 'Пост 2', 'Пост 3', 'Пост 4'];
        for (const content of expected) {
            expect(collected).toContain(content);
        }
    });

    it('возвращает реакции и счётчик комментариев', async () => {
        const { token } = await createUser();
        const post = await createPost(token, { content: 'С реакцией' });

        await request(app)
            .post(`/api/posts/${post.id}/reactions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ emoji: '👍' });

        const res = await request(app)
            .get('/api/posts/feed')
            .set('Authorization', `Bearer ${token}`);

        const item = res.body.items.find((p) => p.id === post.id);
        expect(item).toBeDefined();
        expect(item.reactions).toHaveLength(1);
        expect(item.reactions[0].emoji).toBe('👍');
        expect(item.reactions[0].count).toBe(1);
        expect(item.myReactions).toEqual(['👍']);
        expect(item._count.comments).toBe(0);
    });
});