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
  const { users, families, babies } = await import('@/lib/server/db/schema');
  const owner = db.select().from(users).all()[0];
  const fam = db.select().from(families).all()[0];
  const babyId = randomUUID();
  db.insert(babies)
    .values({
      id: babyId,
      familyId: fam.id,
      name: 'A',
      birthday: '2024-01-01',
      gender: 'girl',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    .run();
  return { ownerId: owner.id, babyId };
}

function mockReq(): any {
  return { headers: new Headers() };
}

describe('withAuthorizedResource', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/server/permissions/session');
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-route-'));
    ctx = await seed(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  async function buildWrapped(
    action: 'baby:read',
    allowedStatuses: readonly string[] = ['active']
  ) {
    const { withAuthorizedResource } = await import('@/lib/server/permissions/route-template');
    const { getDb } = await import('@/lib/server/db/client');
    const { babies } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });

    return withAuthorizedResource({
      action,
      loader: async (id: string) => db.select().from(babies).where(eq(babies.id, id)).get() ?? null,
      getStatus: (row: any) => row.status,
      allowedStatuses,
      toResource: (row: any) => ({ babyId: row.id })
    })(async (_req, _ctx, row: any) => {
      return new Response(JSON.stringify({ ok: true, id: row.id }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
  }

  it('returns 404 for non-UUID id', async () => {
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: Promise.resolve({ id: 'bad-id' }) });
    expect(res.status).toBe(404);
  });

  it('returns 401 when no session', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => {
        const { UnauthorizedError } = await import('@/lib/server/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) });
    expect(res.status).toBe(401);
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('returns 200 when owner reads own baby', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ctx.babyId);
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('returns 404 (not 403) when permission denied', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => randomUUID()
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('returns 404 when row missing from DB', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: Promise.resolve({ id: randomUUID() }) });
    expect(res.status).toBe(404);
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('Codex round-12: status gate fires BEFORE assertPermission — trashed row returns unified 404 even for owner', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const { babies } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    db.update(babies)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: ctx.ownerId })
      .where(eq(babies.id, ctx.babyId))
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read', ['active']);
    const res = await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('Codex round-12: when allowedStatuses includes trashed, the same row IS served', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const { babies } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    db.update(babies)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: ctx.ownerId })
      .where(eq(babies.id, ctx.babyId))
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read', ['trashed']);
    const res = await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) });
    expect(res.status).toBe(200);
    vi.doUnmock('@/lib/server/permissions/session');
  });

  it('Codex review C3: wrapper threads userId to handler', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    let receivedUserId: string | null = null;
    const { withAuthorizedResource } = await import('@/lib/server/permissions/route-template');
    const { getDb } = await import('@/lib/server/db/client');
    const { babies } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });

    const route = withAuthorizedResource({
      action: 'baby:read',
      loader: async (id) => db.select().from(babies).where(eq(babies.id, id)).get() ?? null,
      getStatus: (row: any) => row.status,
      allowedStatuses: ['active'],
      toResource: (row: any) => ({ babyId: row.id })
    })(async (_req, _ctx, _row, userId) => {
      receivedUserId = userId;
      return new Response(JSON.stringify({ ok: true }));
    });
    await route(mockReq(), { params: Promise.resolve({ id: ctx.babyId }) } as any);
    expect(receivedUserId).toBe(ctx.ownerId);
    vi.doUnmock('@/lib/server/permissions/session');
  });
});

describe('withAuthorizedActionRoute', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/server/permissions/session');
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-route-action-'));
    ctx = await seed(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  async function buildRoute() {
    const { withAuthorizedActionRoute } = await import('@/lib/server/permissions/route-template');
    return withAuthorizedActionRoute({
      action: 'trash:view',
      allowRoles: ['owner', 'member']
    })(async (_req: any, { userId }) => {
      return new Response(JSON.stringify({ ok: true, userId }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
  }

  it('allows an owner through a global trash route', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildRoute();
    const res = await route(mockReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(ctx.ownerId);
  });

  it('returns 401 when a global route has no session', async () => {
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => {
        const { UnauthorizedError } = await import('@/lib/server/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const route = await buildRoute();
    const res = await route(mockReq());
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-owner member when route restricts to owner only', async () => {
    const { getDb } = await import('@/lib/server/db/client');
    const { users, families, familyMembers } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    const family = db.select().from(families).all()[0];
    const memberId = randomUUID();
    const now = new Date();
    db.insert(users)
      .values({
        id: memberId,
        name: 'Member',
        email: 'member@local.babyloom',
        emailVerified: true,
        username: 'member',
        role: 'member',
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(familyMembers)
      .values({
        id: randomUUID(),
        familyId: family.id,
        userId: memberId,
        role: 'member',
        joinedAt: Date.now()
      })
      .run();
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => memberId
    }));
    const { withAuthorizedActionRoute } = await import('@/lib/server/permissions/route-template');
    const route = withAuthorizedActionRoute({
      action: 'trash:view',
      allowRoles: ['owner']
    })(async (_req: any, { userId }) => {
      return new Response(JSON.stringify({ ok: true, userId }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    const res = await route(mockReq());
    expect(res.status).toBe(404);
  });
});
