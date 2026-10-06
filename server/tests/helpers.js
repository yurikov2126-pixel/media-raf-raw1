import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let counter = 0;

export function nextPhone() {
    counter += 1;
    return `+7999${String(counter).padStart(7, '0')}`;
}

export function validPayload(overrides = {}) {
    const uniq = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    return {
        firstName: 'Иван',
        lastName: 'Тестов',
        phone: nextPhone(),
        username: `test_${uniq}`,
        password: 'strongPass123',
        direction: 'photo',
        ...overrides
    };
}

export async function createUser(overrides = {}) {
    const payload = validPayload(overrides);
    const res = await request(app).post('/api/auth/register').send(payload);
    if (res.status !== 200) {
        throw new Error(`createUser failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return { user: res.body.user, token: res.body.token, payload };
}

export async function makeAdmin(userId) {
    return prisma.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' }
    });
}

export async function createPost(token, body = {}) {
    const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Test post', ...body });
    if (res.status !== 200) {
        throw new Error(`createPost failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
}

export async function createComment(token, postId, body = {}) {
    const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Test comment', ...body });
    if (res.status !== 200) {
        throw new Error(`createComment failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
}