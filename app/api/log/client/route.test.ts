import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('/api/log/client', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-client-log-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
    vi.doMock('@/lib/auth/server', () => ({
      getAuth: () => ({
        api: {
          getSession: async () => null
        }
      })
    }));
  });

  afterEach(async () => {
    vi.doUnmock('@/lib/auth/server');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('accepts valid client error reports without authentication', async () => {
    const { POST } = await import('@/app/api/log/client/route');

    const res = await POST(request({ message: 'render failed', url: 'http://localhost/timeline' }));

    expect(res.status).toBe(204);
  });

  it('rate limits the 61st report from the same unauthenticated source', async () => {
    const { POST } = await import('@/app/api/log/client/route');
    const { resetClientLogRateLimitForTesting } = await import('@/lib/log/client-rate-limit');
    resetClientLogRateLimitForTesting();

    let res = new Response(null);
    for (let i = 0; i < 61; i += 1) {
      res = await POST(request({ message: `boom ${i}` }));
    }

    expect(res.status).toBe(429);
  });

  function request(body: unknown) {
    return new Request('http://localhost/api/log/client', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10'
      },
      body: JSON.stringify(body)
    });
  }
});
