import { defineConfig } from 'vitest/config';
import 'dotenv/config';

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