import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedOwnerBabyEntries } from './_seed';

function mockReq(): any {
  return { headers: new Headers() };
}

describe('withAuthorizedAction', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seedOwnerBabyEntries>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-action-tmpl-'));
    ctx = await seedOwnerBabyEntries(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('401 when no session', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => {
        const { UnauthorizedError } = await import('@/lib/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:read' })(async () => new Response('x'));
    const res = await route(mockReq());
    expect(res.status).toBe(401);
  });

  it('200 for owner on baby:write action', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:write' })(async (_req, userId) =>
      Response.json({ userId })
    );
    const res = await route(mockReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(ctx.ownerId);
  });

  it('passes trusted userId into resolveResource', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({
      action: 'entry:write',
      resolveResource: async (_req, userId) => ({ authorId: userId })
    })(async () => Response.json({ ok: true }));
    const res = await route(mockReq());
    expect(res.status).toBe(200);
  });

  it('404 (not 403) when stranger tries baby:write', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => randomUUID()
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:write' })(async () => new Response('x'));
    const res = await route(mockReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});
