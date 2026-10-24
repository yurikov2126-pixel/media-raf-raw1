import {defineConfig} from 'vitest/config';

// Hourly safety tests only exercise pure policies and PCM buffer helpers.
// Deliberately NO common tests/setup.js: that suite connects to Prisma
// and deletes test users/posts after each test.
export default defineConfig({
  test:{
    environment:'node',
    globals:true,
    pool:'forks',
    fileParallelism:false,
    include:[
      'tests/radioHourlyHandover.test.js',
      'tests/radioHourlyPcmBounds.test.js',
      'tests/radioHourlyPcmIntegration.test.js',
      'tests/radioHourlyScheduledOnAir.test.js',
      'tests/radioScheduledHourlyAdmission.test.js',
      'tests/radioScheduledHourlyCursor.test.js',
      'tests/radioScheduledHourlyResume.test.js',
      'tests/radioHourlySignalPlanner.test.js',
      'tests/radioTimeSignalPreflight.test.js'
    ]
  }
});
