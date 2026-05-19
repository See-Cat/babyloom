import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 10_000,
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
});
