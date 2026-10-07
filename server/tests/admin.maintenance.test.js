import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, makeAdmin } from './helpers.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const API = '/api/admin/maintenance';

/* Локальный композитный хелпер — как в admin.users.test.js.
 * Возвращает { user, token }, где token валиден для ADMIN-роутов,
 * потому что auth-middleware читает роль из БД, а не из JWT. */
async function createAdmin() {
    const created = await createUser();
    await makeAdmin(created.user.id);
    return { user: created.user, token: created.token };
}

function mkOrphan(suffix = 'jpg') {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const name = `orphan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), 'fake-image-bytes');
    return name;
}

function rmOrphan(name) {
    try {
        fs.unlinkSync(path.join(UPLOADS_DIR, name));
    } catch {
        /* уже удалён — ок */
    }
}

describe('admin/maintenance orphaned files', () => {
    /* ═══════════ СКАН ═══════════ */

    it('scan returns details.orphanFiles.items', async () => {
        const { token } = await createAdmin();
        const name = mkOrphan();
        try {
            const res = await request(app)
                .get(`${API}/scan`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            const item = res.body.details.orphanFiles.items.find(
                (i) => i.filename === name
            );
            expect(item).toBeTruthy();
            expect(item).toMatchObject({
                filename: name,
                url: `/uploads/${name}`,
                ext: '.jpg',
            });
            expect(item.size).toBeGreaterThan(0);
            expect(typeof item.mtime).toBe('string');
        } finally {
            rmOrphan(name);
        }
    });

    /* ═══════════ УДАЛЕНИЕ ОДНОГО ФАЙЛА ═══════════ */

    it('DELETE removes the file', async () => {
        const { token } = await createAdmin();
        const name = mkOrphan();

        const res = await request(app)
            .delete(`${API}/orphaned-files/${name}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(fs.existsSync(path.join(UPLOADS_DIR, name))).toBe(false);
    });

    it('rejects path traversal', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .delete(`${API}/orphaned-files/..%2Fetc%2Fpasswd`)
            .set('Authorization', `Bearer ${token}`);

        // Express декодирует %2F → /, path.basename() отвергает,
        // safeUnlinkOrphan бросает badRequest → глобальный errorHandler → 400.
        expect(res.status).toBe(400);
    });

    it('rejects forbidden extension', async () => {
        const { token } = await createAdmin();
        const name = mkOrphan('sh');
        try {
            const res = await request(app)
                .delete(`${API}/orphaned-files/${name}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/extension/i);
        } finally {
            rmOrphan(name);
        }
    });

    it('404 if file does not exist', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .delete(`${API}/orphaned-files/definitely_missing_${Date.now()}.jpg`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it('409 if file is now referenced in DB (race)', async () => {
        const { user, token } = await createAdmin();
        const name = mkOrphan();

        // Привязываем файл к админу через avatar — collectUsedFiles
        // читает User.avatar и увидит ссылку.
        await prisma.user.update({
            where: { id: user.id },
            data: { avatar: `/uploads/${name}` },
        });

        try {
            const res = await request(app)
                .delete(`${API}/orphaned-files/${name}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(409);
            // Файл не должен быть удалён — он referenced.
            expect(fs.existsSync(path.join(UPLOADS_DIR, name))).toBe(true);
        } finally {
            rmOrphan(name);
        }
    });

    /* ═══════════ БАТЧ-УДАЛЕНИЕ ═══════════ */

    it('purge without filters → 400', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post(`${API}/orphaned-files/purge`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/filenames|olderThanDays/i);
    });

    it('purge by filenames deletes multiple', async () => {
        const { token } = await createAdmin();
        const a = mkOrphan();
        const b = mkOrphan();

        try {
            const res = await request(app)
                .post(`${API}/orphaned-files/purge`)
                .set('Authorization', `Bearer ${token}`)
                .send({ filenames: [a, b] });

            expect(res.status).toBe(200);
            expect(res.body.deletedCount).toBe(2);
            expect(res.body.freedBytes).toBeGreaterThan(0);
            expect(fs.existsSync(path.join(UPLOADS_DIR, a))).toBe(false);
            expect(fs.existsSync(path.join(UPLOADS_DIR, b))).toBe(false);
        } finally {
            rmOrphan(a);
            rmOrphan(b);
        }
    });

    it('purge by olderThanDays', async () => {
        const { token } = await createAdmin();
        const name = mkOrphan();

        // Состариваем файл на 100 дней — должен попасть под фильтр 30.
        const old = new Date(Date.now() - 100 * 86400_000);
        fs.utimesSync(path.join(UPLOADS_DIR, name), old, old);

        try {
            const res = await request(app)
                .post(`${API}/orphaned-files/purge`)
                .set('Authorization', `Bearer ${token}`)
                .send({ olderThanDays: 30 });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toContain(name);
            expect(fs.existsSync(path.join(UPLOADS_DIR, name))).toBe(false);
        } finally {
            rmOrphan(name);
        }
    });

    /* ═══════════ ПРАВА ДОСТУПА ═══════════ */

    it('requires ADMIN', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get(`${API}/scan`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });

    /* ═══════════ АУДИТ: AdminAction ═══════════ */

    it('logs AdminAction on successful DELETE', async () => {
        const { user, token } = await createAdmin();
        const name = mkOrphan();

        const res = await request(app)
            .delete(`${API}/orphaned-files/${name}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);

        const actions = await prisma.adminAction.findMany({
            where: { adminId: user.id, action: 'maintenance_delete_orphan_file' },
            orderBy: { createdAt: 'desc' },
        });
        expect(actions).toHaveLength(1);
        expect(actions[0].affected).toBe(1);
        expect(actions[0].error).toBeNull();
        const payload = JSON.parse(actions[0].payload);
        expect(payload.filename).toBe(name);
    });

    it('logs AdminAction on purge with freedBytes', async () => {
        const { user, token } = await createAdmin();
        const a = mkOrphan();
        const b = mkOrphan();

        try {
            const res = await request(app)
                .post(`${API}/orphaned-files/purge`)
                .set('Authorization', `Bearer ${token}`)
                .send({ filenames: [a, b] });
            expect(res.status).toBe(200);

            const actions = await prisma.adminAction.findMany({
                where: { adminId: user.id, action: 'maintenance_purge_orphan_files' },
                orderBy: { createdAt: 'desc' },
            });
            expect(actions).toHaveLength(1);
            expect(actions[0].affected).toBe(2);
            expect(actions[0].error).toBeNull();
            const payload = JSON.parse(actions[0].payload);
            expect(payload.deletedCount).toBe(2);
            expect(payload.freedBytes).toBeGreaterThan(0);
        } finally {
            rmOrphan(a);
            rmOrphan(b);
        }
    });

    it('logs AdminAction on DELETE failure (404)', async () => {
        const { user, token } = await createAdmin();

        const res = await request(app)
            .delete(`${API}/orphaned-files/definitely_missing_${Date.now()}.jpg`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);

        const actions = await prisma.adminAction.findMany({
            where: { adminId: user.id, action: 'maintenance_delete_orphan_file' },
            orderBy: { createdAt: 'desc' },
        });
        expect(actions).toHaveLength(1);
        expect(actions[0].affected).toBe(0);
        expect(actions[0].error).toMatch(/not found/i);
    });

    it('logs AdminAction on purge failure (400)', async () => {
        const { user, token } = await createAdmin();

        const res = await request(app)
            .post(`${API}/orphaned-files/purge`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);

        const actions = await prisma.adminAction.findMany({
            where: { adminId: user.id, action: 'maintenance_purge_orphan_files' },
            orderBy: { createdAt: 'desc' },
        });
        expect(actions).toHaveLength(1);
        expect(actions[0].affected).toBe(0);
        expect(actions[0].error).toMatch(/filenames|olderThanDays/i);
    });
});