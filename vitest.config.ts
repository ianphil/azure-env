import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/extension.ts'],
    },
    alias: {
      vscode: new URL('./test/__mocks__/vscode.ts', import.meta.url).pathname,
    },
  },
});
