import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function seed(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Test
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/server/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });
  const { getDb } = await import('@/lib/server/db/client');
  const { db } = getDb({ dataDir });
  const { users } = await import('@/lib/server/db/schema');
  return { ownerId: db.select().from(users).all()[0].id };
}

vi.mock('next/headers', () => ({
  headers: async () => new Headers()
}));

describe('withPermission server action wrapper', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/server/permissions/session');
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-action-'));
    ctx = await seed(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  it('returns ok with trusted userId when authorized', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.ownerId
    }));
    const { withPermission } = await import('@/lib/server/permissions/server-action');
    const wrapped = withPermission(
      {
        action: 'member:manage',
        resolveResource: async (_payload: { msg: string }) => undefined
      },
      async (userId, payload: { msg: string }) => ({ userId, payload })
    );
    const res = await wrapped({ msg: 'hi' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.userId).toBe(ctx.ownerId);
      expect(res.data.payload.msg).toBe('hi');
    }
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('returns unauthorized when no session', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => {
        const { UnauthorizedError } = await import('@/lib/server/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const { withPermission } = await import('@/lib/server/permissions/server-action');
    const wrapped = withPermission(
      { action: 'member:manage', resolveResource: async () => undefined },
      async () => 'never'
    );
    const res = await wrapped();
    expect(res).toEqual({ ok: false, error: 'unauthorized' });
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('returns not_found (not 403) when forbidden', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => randomUUID()
    }));
    const { withPermission } = await import('@/lib/server/permissions/server-action');
    const wrapped = withPermission(
      { action: 'member:manage', resolveResource: async () => undefined },
      async () => 'never'
    );
    const res = await wrapped();
    expect(res).toEqual({ ok: false, error: 'not_found' });
    vi.doUnmock('@/lib/server/permissions/session');
  });
});
