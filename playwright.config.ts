import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const e2eDir = resolve(process.cwd(), 'test-data/e2e');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: `BABYLOOM_DATA_DIR=${e2eDir} pnpm dev`,
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
