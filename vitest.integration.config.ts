import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    // Longer timeout for real Azure calls
    testTimeout: 30000,
    // Run integration tests sequentially to avoid rate limiting
    sequence: {
      concurrent: false,
    },
  },
});
