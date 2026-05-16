import { defineConfig } from '@playwright/test';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const e2eDir = resolve(process.cwd(), 'test-data/e2e');

rmSync(e2eDir, { recursive: true, force: true });
mkdirSync(e2eDir, { recursive: true });
writeFileSync(
  `${e2eDir}/config.yaml`,
  `owner:
  username: e2eowner
  password: e2epassword
  nickname: E2E Owner
family:
  name: E2E Home
app:
  baseUrl: http://localhost:3000
  secret: local-e2e-secret-1234567890123456
  timezone: Asia/Shanghai
log:
  level: warn
`,
  'utf-8'
);
chmodSync(`${e2eDir}/config.yaml`, 0o600);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: `BABYLOOM_DATA_DIR=${e2eDir} npm run dev`,
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
