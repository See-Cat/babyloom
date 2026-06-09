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
  const { users, accounts, families, familyMembers, babies, babyMemberPermissions } =
    await import('@/lib/server/db/schema');
  const { hashPassword, ownerInternalEmail } = await import('@/lib/server/bootstrap/owner');

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
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.ownerId, 'baby:purge', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
  });

  it('member without baby_member_permissions row cannot read', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/no_baby_permission_row/);
  });

  it('member with canRead=1 can read but without canWrite row cannot write', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 1,
        canWrite: 0,
        canDelete: 0
      })
      .run();
    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(
        ctx.viewerId,
        'entry:write',
        { babyId: ctx.babyId, authorId: ctx.viewerId },
        { dataDir }
      )
    ).rejects.toThrow(/baby_perm_canWrite_denied/);
  });

  it('member cannot baby:write because baby management is owner only', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.editorId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('member with canWrite=1 can entry:trash regardless of author (no author restriction)', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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
    ).resolves.toBeUndefined();
  });

  it('member cannot purge anything (owner-only)', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:purge',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);
  });

  it('member with canDelete=1 can media:restore regardless of uploader/deleter', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId, deletedBy: ctx.editorId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.ownerId, deletedBy: ctx.ownerId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
  });

  it('system:settings is owner-only — owner allowed, member denied', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'system:settings', undefined, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.editorId, 'system:settings', undefined, { dataDir })
    ).rejects.toThrow(/owner_only/);
    await expect(
      assertPermission(ctx.viewerId, 'system:settings', undefined, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('non-family user is denied for any action', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    const strangerId = randomUUID();
    await expect(
      assertPermission(strangerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/not_family_member/);
  });

  it('cross-family babyId is denied', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    const otherBabyId = randomUUID();
    await expect(
      assertPermission(ctx.ownerId, 'baby:read', { babyId: otherBabyId }, { dataDir })
    ).rejects.toThrow(/cross_family_baby/);
  });

  it('baby_member_permissions override DENIES viewer that had role-read', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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

  it('baby_member_permissions is the sole authority — member with canWrite=1 can write', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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
    ).resolves.toBeUndefined();
  });

  it('baby_member_permissions canRead=0 NARROWS editor — denies what role allowed', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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

  it('baby_member_permissions canDelete=1 lets member trash entries authored by others', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
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
    ).resolves.toBeUndefined();
  });

  it('member:manage is owner only', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'member:manage', undefined, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.editorId, 'member:manage', undefined, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('member:manage rejects target outside the family even when caller is owner', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'member:manage', { targetUserId: randomUUID() }, { dataDir })
    ).rejects.toThrow(/target_not_in_family/);
  });

  it('trash:empty is owner only', async () => {
    const { assertPermission } = await import('@/lib/server/permissions/assert');
    await expect(assertPermission(ctx.ownerId, 'trash:empty', undefined, { dataDir })).resolves
      .toBeUndefined();
    await expect(assertPermission(ctx.editorId, 'trash:empty', undefined, { dataDir })).rejects
      .toThrow(/owner_only/);
    await expect(assertPermission(ctx.viewerId, 'trash:empty', undefined, { dataDir })).rejects
      .toThrow(/owner_only/);
  });
});

describe('evaluate', () => {
  it.each([
    'media:purge',
    'entry:purge',
    'baby:purge',
    'member:manage',
    'family:manage',
    'milestone:manage',
    'system:backup',
    'system:logs'
  ] as const)('does not widen member permissions for owner-only %s', async (action) => {
    const { evaluate } = await import('@/lib/server/permissions/assert');

    expect(
      evaluate({
        role: 'member',
        userId: 'member-id',
        action,
        override: { canRead: 1, canWrite: 1, canDelete: 1 }
      })
    ).toEqual({ allow: false, reason: 'owner_only' });
  });

  it('denies member when override row is missing on baby-scoped action', async () => {
    const { evaluate } = await import('@/lib/server/permissions/assert');

    expect(
      evaluate({
        role: 'member',
        userId: 'member-id',
        action: 'entry:write',
        ownership: { babyId: 'baby-id', authorId: 'member-id' }
      })
    ).toEqual({ allow: false, reason: 'no_baby_permission_row' });
  });

  it('uses override bit as the sole gate', async () => {
    const { evaluate } = await import('@/lib/server/permissions/assert');

    expect(
      evaluate({
        role: 'member',
        userId: 'member-id',
        action: 'entry:write',
        ownership: { babyId: 'baby-id', authorId: 'member-id' },
        override: { canRead: 1, canWrite: 0, canDelete: 1 }
      })
    ).toEqual({ allow: false, reason: 'baby_perm_canWrite_denied' });
  });

  it('allows member when canWrite=1 regardless of authorId', async () => {
    const { evaluate } = await import('@/lib/server/permissions/assert');

    expect(
      evaluate({
        role: 'member',
        userId: 'member-id',
        action: 'entry:write',
        ownership: { babyId: 'baby-id', authorId: 'someone-else' },
        override: { canRead: 1, canWrite: 1, canDelete: 1 }
      })
    ).toEqual({ allow: true, reason: 'allowed' });
  });
});
