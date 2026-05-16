import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedOwnerBabyEntries } from './_seed';

describe('loadAndAssertTarget — babies', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seedOwnerBabyEntries>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-'));
    ctx = await seedOwnerBabyEntries(dataDir);
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

describe('loadAndAssertTarget — entries', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seedOwnerBabyEntries>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-entries-'));
    ctx = await seedOwnerBabyEntries(dataDir);
  });

  it('returns active entry for owner', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.activeEntryId,
      table: 'entries',
      allowedStatuses: ['active'],
      requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
      dataDir
    });
    expect(row.id).toBe(ctx.activeEntryId);
  });

  it('NotFoundError on trashed entry when allowedStatuses=[active]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.trashedEntryId,
        table: 'entries',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('returns trashed entry when allowedStatuses=[trashed]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.trashedEntryId,
      table: 'entries',
      allowedStatuses: ['trashed'],
      requirePermission: { userId: ctx.ownerId, action: 'entry:restore' },
      dataDir
    });
    expect(row.id).toBe(ctx.trashedEntryId);
  });

  it('NotFoundError for active entry under trashed baby', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.hiddenByParentEntryId,
        table: 'entries',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });
});
