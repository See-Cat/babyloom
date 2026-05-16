import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfig', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-config-'));
    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
  });

  it('parses a valid config.yaml', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.owner.username).toBe('alice');
    expect(cfg.owner.password).toBe('secret123');
    expect(cfg.log.level).toBe('info');
  });

  it('rejects config missing owner.password', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/password/);
  });

  it('rejects config with password shorter than 8 chars', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: short
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/at least 8/);
  });

  it('defaults log.level to info when omitted', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  email: alice@example.com
  displayName: Alice
`);
    const { loadConfig } = await import('@/lib/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.log.level).toBe('info');
  });

  it('throws a clear error if file does not exist', async () => {
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/config\.yaml not found/);
  });
});
