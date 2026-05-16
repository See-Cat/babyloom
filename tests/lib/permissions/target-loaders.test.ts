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
  const { users, families, babies } = await import('@/lib/db/schema');
  const ownerUser = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const now = Date.now();
  const activeBabyId = randomUUID();
  const trashedBabyId = randomUUID();

  db.insert(babies)
    .values([
      {
        id: activeBabyId,
        familyId: family.id,
        name: 'A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: trashedBabyId,
        familyId: family.id,
        name: 'T',
        birthday: '2024-01-01',
        gender: 'boy',
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: ownerUser.id
      }
    ])
    .run();

  return { ownerId: ownerUser.id, activeBabyId, trashedBabyId };
}

describe('loadAndAssertTarget — babies', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-'));
    ctx = await seed(dataDir);
  });

  it('returns the active baby for the owner', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.activeBabyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
      dataDir
    });
    expect(row.id).toBe(ctx.activeBabyId);
  });

  it('NotFoundError on non-UUID id', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: 'not-a-uuid',
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('NotFoundError on unknown id', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: randomUUID(),
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('NotFoundError on trashed baby when allowedStatuses=[active]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.trashedBabyId,
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('returns trashed baby when allowedStatuses=[trashed]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.trashedBabyId,
      table: 'babies',
      allowedStatuses: ['trashed'],
      requirePermission: { userId: ctx.ownerId, action: 'baby:restore' },
      dataDir
    });
    expect(row.id).toBe(ctx.trashedBabyId);
  });

  it('ForbiddenError from assertPermission propagates (cross-user stranger)', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.activeBabyId,
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: randomUUID(), action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/forbidden/);
  });
});
