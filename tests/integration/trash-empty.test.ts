import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

async function seed(dataDir: string) {
  writeFileSync(
    join(dataDir, 'config.yaml'),
    `
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
`
  );
  const { resetDbForTesting } = await import('@/lib/server/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/server/db/client');
  const { users, families, familyMembers, babies, entries } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });
  const owner = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];
  const now = Date.now();
  const nowDate = new Date(now);

  const editorId = randomUUID();
  db.insert(users)
    .values({
      id: editorId,
      name: 'Editor',
      email: 'editor@local.babyloom',
      emailVerified: true,
      username: 'editor',
      role: 'editor',
      createdAt: nowDate,
      updatedAt: nowDate
    })
    .run();
  db.insert(familyMembers)
    .values({ id: randomUUID(), familyId: family.id, userId: editorId, role: 'editor', joinedAt: now })
    .run();

  const babyId = randomUUID();
  const blockedBabyId = randomUUID();
  db.insert(babies)
    .values([
      {
        id: babyId,
        familyId: family.id,
        name: 'Baby A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: blockedBabyId,
        familyId: family.id,
        name: 'Baby B',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: owner.id
      }
    ])
    .run();

  const entryIds = [randomUUID(), randomUUID()];
  db.insert(entries)
    .values([
      {
        id: entryIds[0],
        babyId,
        authorId: owner.id,
        content: 'trash one',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: owner.id
      },
      {
        id: entryIds[1],
        babyId,
        authorId: owner.id,
        content: 'trash two',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 1,
        deletedBy: owner.id
      },
      {
        id: randomUUID(),
        babyId: blockedBabyId,
        authorId: owner.id,
        content: 'active child blocks baby purge',
        occurredAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }
    ])
    .run();

  return { ownerId: owner.id, editorId, entryIds, blockedBabyId, db, schemas: { entries, babies } };
}

function post(type = 'entries') {
  return new Request(`http://localhost/api/trash/empty?type=${type}`, { method: 'POST' }) as any;
}

describe('POST /api/trash/empty', () => {
  let dataDir: string;

  beforeEach(() => {
    vi.resetModules();
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-trash-empty-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('owner can empty trashed entries', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/trash/empty/route');
    const res = await POST(post());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toBe(2);
    for (const id of ctx.entryIds) {
      const row = ctx.db.select().from(ctx.schemas.entries).where(eq(ctx.schemas.entries.id, id)).get();
      expect(row?.status).toBe('purged');
    }
  });

  it('editor cannot empty trash', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.editorId }));
    const { POST } = await import('@/app/api/trash/empty/route');
    const res = await POST(post());
    expect(res.status).toBe(404);
  });

  it('archives babies even when they still have active children', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/trash/empty/route');
    const res = await POST(post('babies'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toBe(1);
    expect(body.skipped).toEqual([]);
    const baby = ctx.db
      .select()
      .from(ctx.schemas.babies)
      .where(eq(ctx.schemas.babies.id, ctx.blockedBabyId))
      .get();
    expect(baby?.status).toBe('purged');
  });

  it('rejects an invalid type', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/trash/empty/route');
    const res = await POST(post('bad'));
    expect(res.status).toBe(400);
  });
});
