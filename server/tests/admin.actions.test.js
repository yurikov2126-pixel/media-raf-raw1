import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, makeAdmin } from './helpers.js';

const API = '/api/admin/actions';

async function createAdmin() {
    const created = await createUser();
    await makeAdmin(created.user.id);
    return { user: created.user, token: created.token };
}

async function seedAction({
                              adminId,
                              action = 'test_action',
                              payload = {},
                              affected = 0,
                              duration = 0,
                              error = null,
                              createdAt,
                          }) {
    return prisma.adminAction.create({
        data: {
            adminId,
            action,
            payload: JSON.stringify(payload),
            affected,
            duration,
            error,
            ...(createdAt && { createdAt }),
        },
    });
}

describe('GET /api/admin/actions', () => {
    it('401 без токена', async () => {
        const res = await request(app).get(API);
        expect(res.status).toBe(401);
    });

    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(API)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 — возвращает записи, admin и parsed payload', async () => {
        const { user, token } = await createAdmin();
        const unique = `action_${Date.now()}`;
        await seedAction({
            adminId: user.id,
            action: unique,
            payload: { hello: 'world', n: 42 },
            affected: 3,
            duration: 150,
        });

        const res = await request(app)
            .get(`${API}?action=${unique}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].action).toBe(unique);
        expect(res.body.items[0].affected).toBe(3);
        expect(res.body.items[0].duration).toBe(150);
        expect(res.body.items[0].payload).toEqual({ hello: 'world', n: 42 });
        expect(res.body.items[0].admin).toMatchObject({
            id: user.id,
            username: user.username,
        });
    });

    it('фильтр по adminId', async () => {
        const adminA = await createAdmin();
        const adminB = await createAdmin();
        const unique = `action_${Date.now()}`;
        await seedAction({ adminId: adminA.user.id, action: unique });
        await seedAction({ adminId: adminB.user.id, action: unique });

        const res = await request(app)
            .get(`${API}?action=${unique}&adminId=${adminA.user.id}`)
            .set('Authorization', `Bearer ${adminA.token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].adminId).toBe(adminA.user.id);
    });

    it('фильтр failed=1 — только с ошибками', async () => {
        const { user, token } = await createAdmin();
        const unique = `action_${Date.now()}`;
        await seedAction({ adminId: user.id, action: unique });
        await seedAction({ adminId: user.id, action: unique, error: 'boom' });

        const res = await request(app)
            .get(`${API}?action=${unique}&failed=1`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].error).toBe('boom');
    });

    it('фильтр по датам from/to', async () => {
        const { user, token } = await createAdmin();
        const unique = `action_${Date.now()}`;
        const old = new Date('2020-01-01T00:00:00Z');
        const fresh = new Date();
        await seedAction({ adminId: user.id, action: unique, createdAt: old });
        await seedAction({ adminId: user.id, action: unique, createdAt: fresh });

        const from = '2024-01-01T00:00:00Z';
        const res = await request(app)
            .get(`${API}?action=${unique}&from=${encodeURIComponent(from)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(new Date(res.body.items[0].createdAt).getTime()).toBeGreaterThanOrEqual(
            new Date(from).getTime()
        );
    });

    it('пагинация: limit и page', async () => {
        const { user, token } = await createAdmin();
        const unique = `action_${Date.now()}`;
        for (let i = 0; i < 5; i++) {
            await seedAction({ adminId: user.id, action: unique });
        }

        const p1 = await request(app)
            .get(`${API}?action=${unique}&limit=2&page=1`)
            .set('Authorization', `Bearer ${token}`);
        expect(p1.status).toBe(200);
        expect(p1.body.items).toHaveLength(2);
        expect(p1.body.total).toBeGreaterThanOrEqual(5);

        const p3 = await request(app)
            .get(`${API}?action=${unique}&limit=2&page=3`)
            .set('Authorization', `Bearer ${token}`);
        expect(p3.status).toBe(200);
        expect(p3.body.items).toHaveLength(1);
    });

    it('битый payload не валит роут', async () => {
        const { user, token } = await createAdmin();
        const unique = `action_${Date.now()}`;
        await prisma.adminAction.create({
            data: {
                adminId: user.id,
                action: unique,
                payload: 'not a json{{{',
                affected: 0,
            },
        });

        const res = await request(app)
            .get(`${API}?action=${unique}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.items[0].payload).toHaveProperty('_raw');
    });
});

describe('GET /api/admin/actions/meta', () => {
    it('403 для обычного пользователя', async () => {
        const { token } = await createUser();
        const res = await request(app)
            .get(`${API}/meta`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('200 — возвращает уникальные actions и admins', async () => {
        const { user, token } = await createAdmin();
        const unique = `meta_action_${Date.now()}`;
        await seedAction({ adminId: user.id, action: unique });
        await seedAction({ adminId: user.id, action: unique });

        const res = await request(app)
            .get(`${API}/meta`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.actions).toContain(unique);
        // Уникальный action не дублируется
        const dupCount = res.body.actions.filter((a) => a === unique).length;
        expect(dupCount).toBe(1);
        // Админ с действиями есть в списке
        expect(res.body.admins.find((a) => a.id === user.id)).toBeTruthy();
    });
    describe('GET /api/admin/actions/cleanup-settings', () => {
        it('403 для обычного пользователя', async () => {
            const { token } = await createUser();
            const res = await request(app)
                .get(`${API}/cleanup-settings`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        it('200 — возвращает дефолты при пустых настройках', async () => {
            // Чистим настройки, чтобы получить дефолты
            await prisma.setting.deleteMany({
                where: {
                    key: { in: ['actions_cleanup_enabled', 'actions_cleanup_days'] },
                },
            });

            const { token } = await createAdmin();
            const res = await request(app)
                .get(`${API}/cleanup-settings`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.enabled).toBe(false);
            expect(res.body.days).toBe(180);
            expect(res.body.minDays).toBe(7);
            expect(typeof res.body.total).toBe('number');
        });
    });

    describe('POST /api/admin/actions/cleanup-now', () => {
        it('dry-run не удаляет записи', async () => {
            const { user, token } = await createAdmin();
            const unique = `action_${Date.now()}`;
            const old = new Date(Date.now() - 400 * 86_400_000);
            await seedAction({ adminId: user.id, action: unique, createdAt: old });

            const res = await request(app)
                .post(`${API}/cleanup-now`)
                .set('Authorization', `Bearer ${token}`)
                .send({ dryRun: true });

            expect(res.status).toBe(200);
            expect(res.body.dryRun).toBe(true);
            expect(res.body.wouldDelete).toBeGreaterThanOrEqual(1);

            const stillThere = await prisma.adminAction.findFirst({
                where: { action: unique },
            });
            expect(stillThere).toBeTruthy();
        });

        it('реальная очистка удаляет только старше N дней', async () => {
            const { user, token } = await createAdmin();
            const unique = `action_${Date.now()}`;
            const veryOld = new Date(Date.now() - 500 * 86_400_000);
            const fresh = new Date();
            await seedAction({ adminId: user.id, action: unique, createdAt: veryOld });
            await seedAction({ adminId: user.id, action: unique, createdAt: fresh });

            // Устанавливаем порог 30 дней + включаем
            await prisma.setting.upsert({
                where: { key: 'actions_cleanup_enabled' },
                update: { value: 'true' },
                create: { key: 'actions_cleanup_enabled', value: 'true' },
            });
            await prisma.setting.upsert({
                where: { key: 'actions_cleanup_days' },
                update: { value: '30' },
                create: { key: 'actions_cleanup_days', value: '30' },
            });

            const res = await request(app)
                .post(`${API}/cleanup-now`)
                .set('Authorization', `Bearer ${token}`)
                .send({ dryRun: false });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toBeGreaterThanOrEqual(1);

            // Свежая запись осталась.
            const freshStill = await prisma.adminAction.findFirst({
                where: { action: unique, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
            });
            expect(freshStill).toBeTruthy();

            // Старая — удалена.
            const oldGone = await prisma.adminAction.findFirst({
                where: { action: unique, createdAt: veryOld },
            });
            expect(oldGone).toBeNull();
        });
    });
});