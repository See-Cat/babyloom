import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { users, families, familyMembers, babies, babyMemberPermissions, entries, media } = await import('@/lib/db/schema');
  const { db } = getDb({ dataDir });
  const owner = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];
  const now = Date.now();
  const nowDate = new Date(now);

  const editorId = randomUUID();
  const viewerId = randomUUID();
  const editorMemberId = randomUUID();
  const viewerMemberId = randomUUID();
  db.insert(users)
    .values([
      {
        id: editorId,
        name: 'Editor',
        email: 'editor@local.babyloom',
        emailVerified: true,
        username: 'editor',
        role: 'member',
        createdAt: nowDate,
        updatedAt: nowDate
      },
      {
        id: viewerId,
        name: 'Viewer',
        email: 'viewer@local.babyloom',
        emailVerified: true,
        username: 'viewer',
        role: 'member',
        createdAt: nowDate,
        updatedAt: nowDate
      }
    ])
    .run();
  db.insert(familyMembers)
    .values([
      { id: editorMemberId, familyId: family.id, userId: editorId, role: 'member', joinedAt: now },
      { id: viewerMemberId, familyId: family.id, userId: viewerId, role: 'member', joinedAt: now }
    ])
    .run();

  const activeBabyId = randomUUID();
  const trashedBabyId = randomUUID();
  db.insert(babies)
    .values([
      {
        id: activeBabyId,
        familyId: family.id,
        name: 'Active Baby',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: trashedBabyId,
        familyId: family.id,
        name: 'Trashed Baby',
        birthday: '2024-01-01',
        gender: 'boy',
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 4,
        deletedBy: owner.id
      }
    ])
    .run();

  const ownerEntryId = randomUUID();
  const editorEntryId = randomUUID();
  const parentTrashedEntryId = randomUUID();
  db.insert(entries)
    .values([
      {
        id: ownerEntryId,
        babyId: activeBabyId,
        authorId: owner.id,
        content: 'owner deleted entry',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 1,
        deletedBy: owner.id
      },
      {
        id: editorEntryId,
        babyId: activeBabyId,
        authorId: editorId,
        content: 'editor deleted entry',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 2,
        deletedBy: editorId
      },
      {
        id: parentTrashedEntryId,
        babyId: trashedBabyId,
        authorId: owner.id,
        content: 'child under trashed baby',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 3,
        deletedBy: owner.id
      }
    ])
    .run();

  const mediaId = randomUUID();
  db.insert(media)
    .values({
      id: mediaId,
      babyId: activeBabyId,
      uploadedBy: owner.id,
      clientUploadId: randomUUID(),
      filename: 'photo.jpg',
      status: 'trashed',
      createdAt: now,
      updatedAt: now,
      deletedAt: now - 5,
      deletedBy: owner.id
    })
    .run();

  // Grant editor canDelete=1 on activeBaby. Viewer gets no permission rows.
  db.insert(babyMemberPermissions)
    .values({
      id: randomUUID(),
      familyMemberId: editorMemberId,
      babyId: activeBabyId,
      canRead: 1,
      canWrite: 1,
      canDelete: 1
    })
    .run();

  return { ownerId: owner.id, editorId, viewerId, ownerEntryId, editorEntryId, parentTrashedEntryId };
}

function req(type: string | null = 'entries') {
  const url = type === null ? 'http://localhost/api/trash' : `http://localhost/api/trash?type=${type}`;
  return new Request(url) as any;
}

describe('GET /api/trash', () => {
  let dataDir: string;

  beforeEach(() => {
    vi.resetModules();
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-trash-list-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('owner sees all trashed entries, including rows under a trashed baby', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { GET } = await import('@/app/api/trash/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((row: any) => row.id)).toEqual([
      ctx.ownerEntryId,
      ctx.editorEntryId,
      ctx.parentTrashedEntryId
    ]);
    expect(body.counts.entries).toBe(3);
  });

  it('member with canDelete sees all trashed entries on that baby (binary model)', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({ getSessionUserId: async () => ctx.editorId }));
    const { GET } = await import('@/app/api/trash/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    // Editor has canDelete=1 on activeBaby → sees both owner's and editor's
    // deletions on that baby (author restriction removed per spec §9.1).
    // parentTrashedEntryId is on a different baby (no canDelete) → excluded.
    expect(body.rows.map((row: any) => row.id).sort()).toEqual(
      [ctx.ownerEntryId, ctx.editorEntryId].sort()
    );
  });

  it('member without canDelete cannot use the trash endpoint', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({ getSessionUserId: async () => ctx.viewerId }));
    const { GET } = await import('@/app/api/trash/route');
    const res = await GET(req());
    expect(res.status).toBe(404);
  });

  it('rejects an invalid type', async () => {
    const ctx = await seed(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { GET } = await import('@/app/api/trash/route');
    const res = await GET(req('nope'));
    expect(res.status).toBe(400);
  });
});
