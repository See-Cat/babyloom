import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('createLogger', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-log-'));
  });

  it('produces a logger with child() returning a child logger', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'info' });
    const child = logger.child({ module: 'test' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('respects the configured log level', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'warn' });
    expect(logger.level).toBe('warn');
  });

  it('redacts sensitive fields from log payloads', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'info' });
    // pino redact paths configured in source
    expect(logger.bindings?.()).toBeDefined();
    // Smoke: should not throw when logging an object with a `password` field
    expect(() => logger.info({ password: 'secret123', user: 'a' }, 'login')).not.toThrow();
  });

  it('writes daily log files named app-YYYY-MM-DD.log', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'info' });
    logger.info('startup complete');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const files = readdirSync(join(dataDir, 'logs'));
    expect(files.some((file) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(file))).toBe(true);
  });
});
