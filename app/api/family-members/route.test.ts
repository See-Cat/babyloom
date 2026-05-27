import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function jsonReq(url: string, method: string, body?: unknown): any {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe('POST /api/family-members', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-fm-post-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('account-only creation works without babyAssociations: 201', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST, GET } = await import('@/app/api/family-members/route');

    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username: 'mem01',
        password: 'password1234',
        nickname: 'Member One'
      }) as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.memberId).toBeTruthy();
    expect(body.userId).toBeTruthy();
    expect(body).not.toHaveProperty('role');

    const listRes = await GET(jsonReq('http://localhost/api/family-members', 'GET') as any);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const created = list.members.find((m: any) => m.memberId === body.memberId);
    expect(created.babyPermissions).toEqual([]);
  });

  it('atomic baby associations on create: 201 with permissions persisted', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST, GET } = await import('@/app/api/family-members/route');

    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username: 'mem02',
        password: 'password1234',
        nickname: 'Member Two',
        babyAssociations: { babyIds: [ctx.babyId], permission: 'editor' }
      }) as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    const listRes = await GET(jsonReq('http://localhost/api/family-members', 'GET') as any);
    const list = await listRes.json();
    const created = list.members.find((m: any) => m.memberId === body.memberId);
    expect(created.babyPermissions).toHaveLength(1);
    expect(created.babyPermissions[0].babyId).toBe(ctx.babyId);
    expect(created.babyPermissions[0].permission).toBe('editor');
  });

  it('non-existent babyId in associations: 400, no user created', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/family-members/route');
    const { getDb } = await import('@/lib/db/client');
    const { users } = await import('@/lib/db/schema');

    const beforeCount = getDb({ dataDir }).db.select().from(users).all().length;

    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username: 'mem03',
        password: 'password1234',
        nickname: 'Member Three',
        babyAssociations: { babyIds: [randomUUID()], permission: 'viewer' }
      }) as any
    );
    expect(res.status).toBe(400);

    const afterCount = getDb({ dataDir }).db.select().from(users).all().length;
    expect(afterCount).toBe(beforeCount);
  });

  it('extra role field in body is silently stripped by zod', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/family-members/route');

    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username: 'mem04',
        password: 'password1234',
        nickname: 'Member Four',
        role: 'editor'
      }) as any
    );
    // zod default strips unknown keys; create succeeds, but stored role is 'member'.
    expect(res.status).toBe(201);
    const body = await res.json();

    const { getDb } = await import('@/lib/db/client');
    const { familyMembers } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    const row = db.select().from(familyMembers).all().find((r) => r.id === body.memberId);
    expect(row?.role).toBe('member');
  });

  it('GET excludes trashed babies from babyPermissions', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST, GET } = await import('@/app/api/family-members/route');

    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username: 'mem05',
        password: 'password1234',
        nickname: 'Member Five',
        babyAssociations: { babyIds: [ctx.babyId], permission: 'viewer' }
      }) as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // Insert a row referencing the trashed baby directly.
    const { getDb } = await import('@/lib/db/client');
    const { babyMemberPermissions } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    db.insert(babyMemberPermissions)
      .values({
        id: randomUUID(),
        familyMemberId: body.memberId,
        babyId: ctx.trashedBabyId,
        canRead: 1,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    const listRes = await GET(jsonReq('http://localhost/api/family-members', 'GET') as any);
    const list = await listRes.json();
    const created = list.members.find((m: any) => m.memberId === body.memberId);
    expect(created.babyPermissions).toHaveLength(1);
    expect(created.babyPermissions[0].babyId).toBe(ctx.babyId);
  });

  it('GET returns empty babyPermissions for owner', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { GET } = await import('@/app/api/family-members/route');

    const listRes = await GET(jsonReq('http://localhost/api/family-members', 'GET') as any);
    const list = await listRes.json();
    const owner = list.members.find((m: any) => m.role === 'owner');
    expect(owner).toBeTruthy();
    expect(owner.babyPermissions).toEqual([]);
  });
});

