import request from 'supertest';
import { app } from '../src/app.js';

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