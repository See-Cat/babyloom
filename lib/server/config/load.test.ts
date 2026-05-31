import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfig', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-config-'));
    const { clearConfigCache } = await import('@/lib/server/config/load');
    clearConfigCache();
  });

  it('parses a valid config.yaml', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  nickname: Alice
family:
  name: Alice Home
app:
  baseUrl: http://localhost:3000
  secret: local-test-secret-123456789012345
  timezone: Asia/Shanghai
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.owner.username).toBe('alice');
    expect(cfg.owner.password).toBe('secret123');
    expect(cfg.owner.nickname).toBe('Alice');
    expect(cfg.family.name).toBe('Alice Home');
    expect(cfg.app.baseUrl).toBe('http://localhost:3000');
    expect(cfg.app.secret).toBe('local-test-secret-123456789012345');
    expect(cfg.app.timezone).toBe('Asia/Shanghai');
    expect(cfg.log.level).toBe('info');
  });

  it('rejects config missing owner.password', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/password/);
  });

  it('rejects config with password shorter than 8 chars', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: short
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/at least 6/);
  });

  it('defaults log.level to info when omitted', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.log.level).toBe('info');
    expect(cfg.app.baseUrl).toBe('http://localhost:3000');
    expect(cfg.app.timezone).toBe('Asia/Shanghai');
  });

  it('rejects config with app.secret shorter than 32 chars', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  nickname: Alice
family:
  name: Alice Home
app:
  secret: too-short
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/app.secret/);
  });

  it('rejects config with a non-IANA app.timezone', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
  timezone: UTC+8
`);
    const { loadConfig } = await import('@/lib/server/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/timezone/);
  });

  it('throws a clear error if file does not exist', async () => {
    const { loadConfig } = await import('@/lib/server/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/config\.yaml not found/);
  });
});
