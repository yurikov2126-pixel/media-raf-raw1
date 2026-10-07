import { beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

// Здесь НЕ должно быть `import 'dotenv/config'` —
// он бы загрузил .env и перебил значения из .env.test.

beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';

    const url = process.env.DATABASE_URL || '';
    if (!url) {
        throw new Error('DATABASE_URL не задан. Проверь server/.env.test.');
    }

    // Проверка «не запущены ли тесты против прод-БД» имеет смысл только
    // на локальной машине. В CI Postgres поднимается как сервис (обычно
    // на стандартном порту 5432) — там эта проверка ложно срабатывает.
    // GitHub Actions и другие CI выставляют переменную CI=true.
    const isCI = !!process.env.CI;
    if (!isCI && /@localhost:5432[/?]/.test(url)) {
        throw new Error(
            'DATABASE_URL указывает на порт 5432. Ожидается 5434 (docker-compose.dev.yml).'
        );
    }
});

afterEach(async () => {
    await new Promise((r) => setTimeout(r, 250));

    await prisma.post.deleteMany({
        where: {
            OR: [
                { author: { phone: { startsWith: '+7999' } } },
                { author: { username: { startsWith: 'test_' } } }
            ]
        }
    });

    await prisma.user.deleteMany({
        where: {
            OR: [
                { phone: { startsWith: '+7999' } },
                { username: { startsWith: 'test_' } }
            ]
        }
    });
});

afterAll(async () => {
    await prisma.$disconnect();
});