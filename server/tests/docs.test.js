import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('GET /api/docs', () => {
    it('200 — отдаёт Swagger UI (HTML)', async () => {
        const res = await request(app).get('/api/docs/');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
    });

    it('GET /api/docs.json — возвращает валидный OpenAPI spec', async () => {
        const res = await request(app).get('/api/docs.json');
        expect(res.status).toBe(200);
        expect(res.body.openapi).toMatch(/^3\./);
        expect(res.body.info.title).toBe('MEDIA·RAF·RAW API');
        expect(res.body.paths).toBeTypeOf('object');
        // Проверяем, что хотя бы health задокументирован
        expect(res.body.paths['/health']).toBeDefined();
        expect(res.body.paths['/auth/login']).toBeDefined();
    });
});