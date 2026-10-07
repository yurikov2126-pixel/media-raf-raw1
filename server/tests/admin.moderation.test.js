import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, makeAdmin, createPost } from './helpers.js';

/* ─────────── Локальные композитные хелперы ─────────── */

async function createAdmin() {
    const created = await createUser();
    const updated = await makeAdmin(created.user.id);
    return {
        user: { ...created.user, role: updated.role },
        token: created.token,
        payload: created.payload,
    };
}

async function createReport(reporterToken, { targetType, targetId, reason = 'spam', comment = 'test' }) {
    const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({ targetType, targetId, reason, comment });
    if (res.status !== 200) {
        throw new Error(`createReport failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.report;
}

/**
 * listReports может возвращать массив или объект с items/reports/data.
 * Достаём элементы устойчиво — чтобы тест не зависел от формы ответа.
 */
function extractItems(body) {
    if (Array.isArray(body)) return body;
    return body.items || body.reports || body.data || [];
}

const API = '/api/admin';

/* ═══════════ GET /api/admin/reports ═══════════ */

describe('GET /api/admin/reports', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(`${API}/reports`);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/reports`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 для админа — содержит созданную жалобу', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'reported' });
        const report = await createReport(reporter.token, {
            targetType: 'post',
            targetId: post.id,
            reason: 'spam',
        });

        const res = await request(app)
            .get(`${API}/reports`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const items = extractItems(res.body);
        expect(items.some((r) => r.id === report.id)).toBe(true);
    });

    it('200 — фильтр по status=NEW', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'x' });
        await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .get(`${API}/reports?status=NEW`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const items = extractItems(res.body);
        for (const r of items) {
            expect(r.status).toBe('NEW');
        }
    });
});

/* ═══════════ GET /api/admin/reports/meta ═══════════ */

describe('GET /api/admin/reports/meta', () => {
    it('200 — возвращает targetTypes, reasons, statuses', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .get(`${API}/reports/meta`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.targetTypes)).toBe(true);
        expect(Array.isArray(res.body.reasons)).toBe(true);
        expect(Array.isArray(res.body.statuses)).toBe(true);
    });
});

/* ═══════════ PATCH /api/admin/reports/:id ═══════════ */

describe('PATCH /api/admin/reports/:id', () => {
    it('200 — меняет статус на IN_REVIEW', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'x' });
        const report = await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .patch(`${API}/reports/${report.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'IN_REVIEW' });

        expect(res.status).toBe(200);

        const inDb = await prisma.report.findUnique({ where: { id: report.id } });
        expect(inDb.status).toBe('IN_REVIEW');
    });

    it('200 — RESOLVED с resolution, ставит resolvedBy', async () => {
        const { token, user: admin } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'x' });
        const report = await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .patch(`${API}/reports/${report.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'RESOLVED', resolution: 'Принято во внимание' });

        expect(res.status).toBe(200);

        const inDb = await prisma.report.findUnique({ where: { id: report.id } });
        expect(inDb.status).toBe('RESOLVED');
        expect(inDb.resolution).toBe('Принято во внимание');
        expect(inDb.resolvedBy).toBe(admin.id);
    });

    it('404 на несуществующий id', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .patch(`${API}/reports/00000000-0000-0000-0000-000000000000`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'RESOLVED' });
        expect(res.status).toBe(404);
    });
});

/* ═══════════ POST /api/admin/reports/:id/delete-content ═══════════ */

describe('POST /api/admin/reports/:id/delete-content', () => {
    it('удаляет пост и помечает жалобу решённой', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'will be deleted' });
        const report = await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .post(`${API}/reports/${report.id}/delete-content`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const postGone = await prisma.post.findUnique({ where: { id: post.id } });
        expect(postGone).toBeNull();

        const inDb = await prisma.report.findUnique({ where: { id: report.id } });
        expect(inDb.status).toBe('RESOLVED');
    });

    it('404 при несуществующем report id', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post(`${API}/reports/00000000-0000-0000-0000-000000000000/delete-content`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

/* ═══════════ POST /api/admin/reports/:id/ban-user ═══════════ */

describe('POST /api/admin/reports/:id/ban-user', () => {
    it('банит автора поста и помечает жалобу решённой', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'x' });
        const report = await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .post(`${API}/reports/${report.id}/ban-user`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const authorInDb = await prisma.user.findUnique({ where: { id: author.user.id } });
        expect(authorInDb.isBanned).toBe(true);

        const reportInDb = await prisma.report.findUnique({ where: { id: report.id } });
        expect(reportInDb.status).toBe('RESOLVED');
        expect(reportInDb.resolution).toMatch(/заблокирован/i);
    });

    it('404 при несуществующем report id', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post(`${API}/reports/00000000-0000-0000-0000-000000000000/ban-user`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('404 при несуществующем report id', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post(`${API}/reports/00000000-0000-0000-0000-000000000000/ban-user`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

/* ═══════════ DELETE /api/admin/reports/:id ═══════════ */

describe('DELETE /api/admin/reports/:id', () => {
    it('200 — удаляет жалобу из БД', async () => {
        const { token } = await createAdmin();
        const reporter = await createUser();
        const author = await createUser();
        const post = await createPost(author.token, { content: 'x' });
        const report = await createReport(reporter.token, { targetType: 'post', targetId: post.id });

        const res = await request(app)
            .delete(`${API}/reports/${report.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const gone = await prisma.report.findUnique({ where: { id: report.id } });
        expect(gone).toBeNull();
    });

    it('404 на несуществующий id', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .delete(`${API}/reports/00000000-0000-0000-0000-000000000000`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});