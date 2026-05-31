import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VALID = `
owner:
  username: alice
  password: secret123
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
`;

describe('resolveTimezone', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-tz-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
    const { clearConfigCache } = await import('@/lib/server/config/load');
    clearConfigCache();
  });

  afterEach(() => {
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('returns the configured timezone', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `${VALID}  timezone: America/New_York\n`);
    const { resolveTimezone } = await import('./resolve-timezone');
    expect(resolveTimezone()).toBe('America/New_York');
  });

  it('falls back to the default when config.yaml is absent (build introspection)', async () => {
    const { resolveTimezone } = await import('./resolve-timezone');
    expect(resolveTimezone()).toBe('Asia/Shanghai');
  });

  it('rethrows a malformed config instead of silently defaulting', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `${VALID}  timezone: UTC+8\n`);
    const { resolveTimezone } = await import('./resolve-timezone');
    expect(() => resolveTimezone()).toThrow(/Invalid config\.yaml/);
  });
});
