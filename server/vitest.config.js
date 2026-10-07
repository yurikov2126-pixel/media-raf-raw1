import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Тесты всегда читают .env.test, а не .env.
// override: true — чтобы значения из .env не подменили тестовые.
loadEnv({ path: path.resolve(__dirname, '.env.test'), override: true });

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: ['node_modules/', 'tests/', 'prisma/']
        },
        pool: 'forks',
        fileParallelism: false
    }
});