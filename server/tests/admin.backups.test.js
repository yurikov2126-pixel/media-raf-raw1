import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createUser, makeAdmin } from './helpers.js';

/* ─────────── Локальный композитный хелпер ─────────── */

async function createAdmin() {
    const created = await createUser();
    const updated = await makeAdmin(created.user.id);
    return {
        user: { ...created.user, role: updated.role },
        token: created.token,
        payload: created.payload,
    };
}

/**
 * listBackups() может возвращать массив или объект с items/files/data.
 * Достаём элементы устойчиво — чтобы тест не зависел от формы ответа.
 */
function extractBackups(body) {
    if (Array.isArray(body)) return body;
    return body.items || body.files || body.data || [];
}

const API = '/api/admin';
const MISSING_FILE = 'nonexistent-file-for-tests.dump';

/* ═══════════ GET /api/admin/backups ═══════════ */

describe('GET /api/admin/backups', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}/backups`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/backups`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 для админа — возвращает список (массив или объект с items)', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}/backups`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const items = extractBackups(res.body);
        expect(Array.isArray(items)).toBe(true);
    });
});

/* ═══════════ POST /api/admin/backups/restore ═══════════ */

describe('POST /api/admin/backups/restore', () => {
    it('401 без токена', async () => {
        const res = await request(app)
            .post(`${API}/backups/restore`)
            .send({ filename: MISSING_FILE });
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .post(`${API}/backups/restore`)
            .set('Authorization', `Bearer ${token}`)
            .send({ filename: MISSING_FILE });
        expect(res.status).toBe(403);
    });

    it('400 без filename (проверка до вызова restoreBackup)', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post(`${API}/backups/restore`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/filename/i);
    });
});

/* ═══════════ GET /api/admin/backups/:filename/download ═══════════ */

describe('GET /api/admin/backups/:filename/download', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}/backups/${MISSING_FILE}/download`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/backups/${MISSING_FILE}/download`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('400 для имени без расширения .dump/.sql', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}/backups/evil.exe/download`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/имя файла/i);
    });

    it('404 для валидного имени, но несуществующего файла', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}/backups/${MISSING_FILE}/download`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/не найден/i);
    });

    it('безопасно обрабатывает path traversal — не отдаёт /etc/passwd', async () => {
        // Express + path.basename в роуте должны свести попытку выйти
        // за BACKUPS_DIR к 400 или 404, но ни в коем случае не к 200.
        const { token } = await createAdmin();
        const attacks = [
            '..%2F..%2Fetc%2Fpasswd',
            '..%2F..%2Fetc%2Fpasswd.dump',
            '....%2F%2F..%2Fetc%2Fshadow.dump',
        ];

        for (const name of attacks) {
            const res = await request(app)
                .get(`${API}/backups/${name}/download`)
                .set('Authorization', `Bearer ${token}`);
            expect([400, 404]).toContain(res.status);
        }
    });
});

/* ═══════════ DELETE /api/admin/backups/:filename ═══════════ */

describe('DELETE /api/admin/backups/:filename', () => {
    it('401 без токена', async () => {
        const res = await request(app).delete(`${API}/backups/${MISSING_FILE}`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .delete(`${API}/backups/${MISSING_FILE}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    /* Успешное удаление не тестируем: deleteBackup() физически удаляет файл,
       а в тестовой среде файлов бэкапов может не быть или их создание требует pg_dump. */
});