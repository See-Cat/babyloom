import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedOwnerBabyEntries } from '../../lib/permissions/_seed';

// Helpers ------------------------------------------------------------------

function jsonReq(url: string, method: string, body?: unknown): any {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function seedMember(opts: {
  dataDir: string;
  role?: 'owner' | 'member';
  familyId?: string;
}) {
  const { getDb } = await import('@/lib/db/client');
  const { users, families, familyMembers } = await import('@/lib/db/schema');
  const { db } = getDb({ dataDir: opts.dataDir });
  const family = opts.familyId
    ? { id: opts.familyId }
    : db.select().from(families).all()[0];
  const userId = randomUUID();
  const memberId = randomUUID();
  const now = new Date();
  db.insert(users)
    .values({
      id: userId,
      name: `user-${userId.slice(0, 8)}`,
      email: `${userId.slice(0, 8)}@local.babyloom`,
      emailVerified: true,
      username: `u${userId.slice(0, 8)}`,
      role: 'member',
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(familyMembers)
    .values({
      id: memberId,
      familyId: family.id,
      userId,
      role: opts.role ?? 'member',
      joinedAt: Date.now()
    })
    .run();
  return { userId, memberId, familyId: family.id };
}

// POST /api/family-members/:memberId/baby-permissions ---------------------

describe('POST /api/family-members/:memberId/baby-permissions', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-baby-perms-post-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('owner happy path: writes rows and returns 201', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });
    const { getDb } = await import('@/lib/db/client');
    const { babyMemberPermissions } = await import('@/lib/db/schema');

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [ctx.babyId],
      permission: 'editor'
    }) as any);
    expect(res.status).toBe(201);

    const { db } = getDb({ dataDir });
    const rows = db
      .select()
      .from(babyMemberPermissions)
      .all()
      .filter((r) => r.familyMemberId === target.memberId);
    expect(rows.length).toBe(1);
    expect(rows[0].canWrite).toBe(1);
    expect(rows[0].canDelete).toBe(1);
  });

  it('non-owner caller: 404', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const caller = await seedMember({ dataDir });
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => caller.userId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [ctx.babyId],
      permission: 'viewer'
    }) as any);
    expect(res.status).toBe(404);
  });

  it('invalid permission value: 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [ctx.babyId],
      permission: 'admin'
    }) as any);
    expect(res.status).toBe(400);
  });

  it('target is owner: 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/db/client');
    const { familyMembers } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    const ownerMember = db.select().from(familyMembers).all()[0];

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${ownerMember.id}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [ctx.babyId],
      permission: 'viewer'
    }) as any);
    expect(res.status).toBe(400);
  });

  it('babyId is trashed: 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [ctx.trashedBabyId],
      permission: 'viewer'
    }) as any);
    expect(res.status).toBe(400);
  });

  it('cross-family babyId: 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });
    const foreignBabyId = randomUUID();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions`;
    const res = await POST(jsonReq(url, 'POST', {
      babyIds: [foreignBabyId],
      permission: 'viewer'
    }) as any);
    expect(res.status).toBe(400);
  });
});

// PATCH/DELETE /api/family-members/:memberId/baby-permissions/:babyId -----

describe('PATCH /api/family-members/:memberId/baby-permissions/:babyId', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-baby-perms-patch-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('happy path: updates permission, returns 200', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });
    const { getDb } = await import('@/lib/db/client');
    const { babyMemberPermissions } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    // Seed an existing viewer row.
    db.insert(babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: target.memberId,
        canRead: 1,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { PATCH } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/[babyId]/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions/${ctx.babyId}`;
    const res = await PATCH(jsonReq(url, 'PATCH', { permission: 'editor' }) as any);
    expect(res.status).toBe(200);

    const row = db
      .select()
      .from(babyMemberPermissions)
      .all()
      .find((r) => r.familyMemberId === target.memberId && r.babyId === ctx.babyId);
    expect(row?.canWrite).toBe(1);
    expect(row?.canDelete).toBe(1);
  });

  it('no existing row: 404', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { PATCH } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/[babyId]/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions/${ctx.babyId}`;
    const res = await PATCH(jsonReq(url, 'PATCH', { permission: 'editor' }) as any);
    expect(res.status).toBe(404);
  });

  it('non-owner caller: 404', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const caller = await seedMember({ dataDir });
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => caller.userId
    }));
    const { PATCH } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/[babyId]/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions/${ctx.babyId}`;
    const res = await PATCH(jsonReq(url, 'PATCH', { permission: 'editor' }) as any);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/family-members/:memberId/baby-permissions/:babyId', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-baby-perms-delete-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('happy path: deletes row, returns 200', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });
    const { getDb } = await import('@/lib/db/client');
    const { babyMemberPermissions } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    db.insert(babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: target.memberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { DELETE } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/[babyId]/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions/${ctx.babyId}`;
    const res = await DELETE(jsonReq(url, 'DELETE') as any);
    expect(res.status).toBe(200);

    const rows = db
      .select()
      .from(babyMemberPermissions)
      .all()
      .filter((r) => r.familyMemberId === target.memberId && r.babyId === ctx.babyId);
    expect(rows.length).toBe(0);
  });

  it('non-existent row: idempotent 200', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const target = await seedMember({ dataDir });

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { DELETE } = await import(
      '@/app/api/family-members/[memberId]/baby-permissions/[babyId]/route'
    );

    const url = `http://localhost/api/family-members/${target.memberId}/baby-permissions/${ctx.babyId}`;
    const res = await DELETE(jsonReq(url, 'DELETE') as any);
    expect(res.status).toBe(200);
  });
});
