import { defineConfig } from '@playwright/test';
import { rmSync, mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Prepare the E2E data dir synchronously before webServer boots.
// Guarded so worker re-imports do not nuke an already-migrated DB.
const e2eDir = resolve(process.cwd(), 'test-data/e2e');
const configPath = `${e2eDir}/config.yaml`;
if (!existsSync(configPath)) {
  rmSync(e2eDir, { recursive: true, force: true });
  mkdirSync(e2eDir, { recursive: true });
  writeFileSync(
    configPath,
    `owner:
  username: e2eowner
  password: e2epassword
  email: e2e@example.com
  displayName: E2E Owner
log:
  level: warn
`,
    'utf-8'
  );
  chmodSync(configPath, 0o600);
}

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
    command: `BABYLOOM_DATA_DIR=${e2eDir} pnpm dev`,
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
