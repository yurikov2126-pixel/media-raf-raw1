import { beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
});

afterEach(async () => {
    // Ждём завершения fire-and-forget задач (gamification, notify)
    await new Promise((r) => setTimeout(r, 250));

    // Посты удаляются каскадом вместе с юзерами,
    // но на всякий случай чистим и их — если автор не наш.
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