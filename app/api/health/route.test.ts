import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('/api/health', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-health-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
    vi.doMock('@/instrumentation.node', () => ({
      ensureStartup: async () => {}
    }));
    vi.doMock('@/lib/server/db/client', () => ({
      getDb: () => ({
        raw: {
          prepare: () => ({
            get: () => ({ ok: 1 })
          })
        }
      })
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/instrumentation.node');
    vi.doUnmock('@/lib/server/db/client');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
    chmodSync(dataDir, 0o700);
  });

  it('reports whether the data directory is writable', async () => {
    const { GET } = await import('@/app/api/health/route');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, dbReady: true, dataDirWritable: true });
  });
});
