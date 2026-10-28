import { defineConfig } from 'vitest/config';

// Only pure MCHS algorithm tests. No shared setup, Prisma client, .env.test,
// production database connection, global cleanup hooks, or network services.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/mchsAudioTransitionPlan.test.js', 'tests/mchsRadioResumePlan.test.js', 'tests/mchsRadioAuthorityInspection.test.js', 'tests/mchsEventSequenceInspection.test.js', 'tests/mchsObservationOrder.test.js', 'tests/mchsQueueAssessment.test.js', 'tests/mchsObservationAnalyzer.test.js', 'tests/mchsAnalyzerHealth.test.js', 'tests/mchsDeliveryDiagnostics.test.js'],
    setupFiles: [],
    pool: 'forks',
    fileParallelism: false,
  },
});
