import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 10_000,
    include: [
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'eslint-rules/**/*.test.{ts,js}',
      'tests/integration/**/*.test.{ts,tsx}'
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
});
