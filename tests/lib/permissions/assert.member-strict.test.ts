import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, families, familyMembers, babies, babyMemberPermissions } = await import(
    '@/lib/db/schema'
  );
  const { ownerInternalEmail } = await import('@/lib/bootstrap/owner');

  const ownerUser = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const nowMs = Date.now();
  const nowDate = new Date(nowMs);

  const memberUserId = randomUUID();
  db.insert(users)
    .values({
      id: memberUserId,
      name: 'member',
      email: ownerInternalEmail('member'),
      emailVerified: true,
      username: 'member',
      role: 'member',
      createdAt: nowDate,
      updatedAt: nowDate
    })
    .run();

  const memberFamilyMemberId = randomUUID();
  db.insert(familyMembers)
    .values({
      id: memberFamilyMemberId,
      familyId: family.id,
      userId: memberUserId,
      role: 'member',
      joinedAt: nowMs
    })
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
    memberUserId,
    memberFamilyMemberId,
    babyId,
    db,
    schemas: { babyMemberPermissions }
  };
}

describe('assertPermission strict member rule', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-perm-strict-'));
    ctx = await seed(dataDir);
  });

  it('rejects non-owner without baby_member_permissions row', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    const { ForbiddenError } = await import('@/lib/permissions/errors');
    await expect(
      assertPermission(ctx.memberUserId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows owner without override row', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
  });

  it('allows member with canWrite=1 to write entry authored by someone else', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.memberFamilyMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    await expect(
      assertPermission(
        ctx.memberUserId,
        'entry:write',
        { babyId: ctx.babyId, authorId: ctx.ownerId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
  });

  it('denies member with canWrite=0 even though row exists', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.memberFamilyMemberId,
        canRead: 1,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    await expect(
      assertPermission(
        ctx.memberUserId,
        'entry:write',
        { babyId: ctx.babyId, authorId: ctx.memberUserId },
        { dataDir }
      )
    ).rejects.toThrow(/baby_perm_canWrite_denied/);
  });
});
