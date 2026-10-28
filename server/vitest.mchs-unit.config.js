import { defineConfig } from 'vitest/config';

// Only pure MCHS algorithm tests. No shared setup, Prisma client, .env.test,
// production database connection, global cleanup hooks, or network services.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/mchsAudioTransitionPlan.test.js', 'tests/mchsRadioResumePlan.test.js'],
    setupFiles: [],
    pool: 'forks',
    fileParallelism: false,
  },
});
