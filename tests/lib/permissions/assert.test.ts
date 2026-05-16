import { describe, it, expect, beforeEach } from 'vitest';
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
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, accounts, families, familyMembers, babies, babyMemberPermissions } =
    await import('@/lib/db/schema');
  const { hashPassword, ownerInternalEmail } = await import('@/lib/bootstrap/owner');

  const ownerUser = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const nowMs = Date.now();
  const nowDate = new Date(nowMs);

  function seedMember(username: string, role: 'editor' | 'viewer') {
    const userId = randomUUID();
    const email = ownerInternalEmail(username);
    db.insert(users)
      .values({
        id: userId,
        name: username,
        email,
        emailVerified: true,
        username,
        role,
        createdAt: nowDate,
        updatedAt: nowDate
      })
      .run();
    db.insert(accounts)
      .values({
        id: randomUUID(),
        userId,
        providerId: 'credential',
        accountId: email,
        password: hashPassword(`${username}-test-pw`),
        createdAt: nowDate,
        updatedAt: nowDate
      })
      .run();
    return userId;
  }

  const editorUserId = seedMember('editor', 'editor');
  const viewerUserId = seedMember('viewer', 'viewer');

  const editorMemberId = randomUUID();
  const viewerMemberId = randomUUID();
  db.insert(familyMembers)
    .values([
      {
        id: editorMemberId,
        familyId: family.id,
        userId: editorUserId,
        role: 'editor',
        joinedAt: nowMs
      },
      {
        id: viewerMemberId,
        familyId: family.id,
        userId: viewerUserId,
        role: 'viewer',
        joinedAt: nowMs
      }
    ])
    .run();

  const babyId = randomUUID();
  db.insert(babies)
    .values({
      id: babyId,
      familyId: family.id,
      name: 'Baby A',
      birthday: '2024-01-01',
      gender: 'girl',
      status: 'active',
      createdAt: nowMs,
      updatedAt: nowMs
    })
    .run();

  return {
    ownerId: ownerUser.id,
    editorId: editorUserId,
    viewerId: viewerUserId,
    editorMemberId,
    viewerMemberId,
    familyId: family.id,
    babyId,
    db,
    schemas: { babyMemberPermissions }
  };
}

describe('assertPermission §5.4 matrix', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-perm-'));
    ctx = await seed(dataDir);
  });

  it('owner can do anything baby-scoped', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.ownerId, 'baby:purge', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
  });

  it('viewer can read but cannot write', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.viewerId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/forbidden/);
  });

  it('editor cannot baby:write because baby management is owner only', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.editorId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('editor can entry:trash own, cannot entry:trash others', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_author/);
  });

  it('editor cannot purge anything', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:purge',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);
  });

  it('editor can media:restore own only AND only what they trashed', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId, deletedBy: ctx.editorId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId, deletedBy: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_did_not_delete/);
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.ownerId, deletedBy: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_uploader/);
  });

  it('non-family user is denied for any action', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    const strangerId = randomUUID();
    await expect(
      assertPermission(strangerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/not_family_member/);
  });

  it('cross-family babyId is denied', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    const otherBabyId = randomUUID();
    await expect(
      assertPermission(ctx.ownerId, 'baby:read', { babyId: otherBabyId }, { dataDir })
    ).rejects.toThrow(/cross_family_baby/);
  });

  it('baby_member_permissions override DENIES viewer that had role-read', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 0,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/baby_perm_canRead_denied/);
  });

  it('baby_member_permissions override does NOT widen — editor with canDelete=1 still cannot purge (Codex round 10 finding #1)', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    await expect(
      assertPermission(
        ctx.editorId,
        'entry:purge',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);
    await expect(
      assertPermission(
        ctx.editorId,
        'media:purge',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);
    await expect(
      assertPermission(ctx.editorId, 'baby:trash', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);
    await expect(
      assertPermission(ctx.editorId, 'baby:purge', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('baby_member_permissions override does NOT widen — viewer with canWrite=1 still cannot write', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    await expect(
      assertPermission(
        ctx.viewerId,
        'entry:write',
        { babyId: ctx.babyId, authorId: ctx.viewerId },
        { dataDir }
      )
    ).rejects.toThrow(/viewer_cannot_write/);
  });

  it('baby_member_permissions canRead=0 NARROWS editor — denies what role allowed', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 0,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    await expect(
      assertPermission(ctx.editorId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/baby_perm_canRead_denied/);
  });

  it('baby_member_permissions canWrite=1 with present row does NOT short-circuit ownership check', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_author/);
  });

  it('member:manage is owner only', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'member:manage', undefined, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.editorId, 'member:manage', undefined, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });
});
