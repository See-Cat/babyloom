import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('getDb', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-db-'));
    const { resetDbForTesting } = await import('@/lib/server/db/client');
    resetDbForTesting();
  });

  it('opens an sqlite file at data/db/babyloom.sqlite', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const { db, raw } = getDb({ dataDir });
    expect(db).toBeDefined();
    expect(raw.open).toBe(true);
  });

  it('applies all §14 PRAGMAs on first open', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const { raw } = getDb({ dataDir });
    expect(raw.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(raw.pragma('synchronous', { simple: true })).toBe(1); // NORMAL = 1
    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(raw.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(raw.pragma('temp_store', { simple: true })).toBe(2); // MEMORY = 2
  });

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const a = getDb({ dataDir });
    const b = getDb({ dataDir });
    expect(a.raw).toBe(b.raw);
  });
});
