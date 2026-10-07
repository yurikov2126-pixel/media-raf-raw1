import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createUser, makeAdmin } from './helpers.js';

async function createAdmin() {
    const created = await createUser();
    const updated = await makeAdmin(created.user.id);
    return { user: { ...created.user, role: updated.role }, token: created.token };
}

const API = '/api/admin';

describe('GET /api/admin/modules', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}/modules`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 — возвращает список модулей с ключами', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.modules)).toBe(true);
        expect(res.body.modules.length).toBeGreaterThan(0);

        for (const m of res.body.modules) {
            expect(typeof m.key).toBe('string');
            expect(typeof m.label).toBe('string');
            expect(typeof m.enabled).toBe('boolean');
        }
    });
});

describe('PUT /api/admin/modules', () => {
    it('401 без токена', async () => {
        const res = await request(app)
            .put(`${API}/modules`)
            .send({ modules: { feed: false } });
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({ modules: { feed: false } });
        expect(res.status).toBe(403);
    });

    it('400 без поля modules', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/modules/i);
    });

    it('400 если все модули выключены', async () => {
        const { token } = await createAdmin();
        const list = await request(app)
            .get(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`);
        const allOff = Object.fromEntries(
            list.body.modules.map((m) => [m.key, false])
        );

        const res = await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({ modules: allOff });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/хотя бы один/i);

        // Восстанавливаем исходное состояние
        const original = Object.fromEntries(
            list.body.modules.map((m) => [m.key, m.enabled])
        );
        await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({ modules: original });
    });

    it('200 — меняет состояние модуля', async () => {
        const { token } = await createAdmin();
        const list = await request(app)
            .get(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`);

        const first = list.body.modules[0];
        const other = list.body.modules[1];

        // Формируем payload так, чтобы хотя бы один остался включённым
        const payload = {};
        if (first.enabled) {
            // Хотим выключить first — включаем other, если он был выключен
            payload[first.key] = false;
            if (other && !other.enabled) payload[other.key] = true;
        } else {
            // Хотим включить first — не трогаем other
            payload[first.key] = true;
        }

        const res = await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({ modules: payload });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const after = await request(app)
            .get(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`);
        const changed = after.body.modules.find((m) => m.key === first.key);
        expect(changed.enabled).toBe(!first.enabled);

        // Восстанавливаем всё как было
        const original = Object.fromEntries(
            list.body.modules.map((m) => [m.key, m.enabled])
        );
        await request(app)
            .put(`${API}/modules`)
            .set('Authorization', `Bearer ${token}`)
            .send({ modules: original });
    });
});