import { beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
});

afterEach(async () => {
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