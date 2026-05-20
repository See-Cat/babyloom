import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../migrate';
import { getDb, resetDbForTesting } from '../client';
import { babies, babyMemberPermissions, families, familyMembers, users } from '../schema';

function seed() {
  const dataDir = mkdtempSync(join(tmpdir(), 'babyloom-permissions-query-'));
  resetDbForTesting();
  runMigrations(dataDir);

  const { db } = getDb({ dataDir });
  const now = Date.now();
  const nowDate = new Date(now);
  const ownerUserId = randomUUID();
  const editorUserId = randomUUID();
  const viewerUserId = randomUUID();
  const familyId = randomUUID();
  const ownerMemberId = randomUUID();
  const editorMemberId = randomUUID();
  const viewerMemberId = randomUUID();
  const babyAId = randomUUID();
  const babyBId = randomUUID();
  const trashedBabyId = randomUUID();

  db.insert(users)
    .values([
      {
        id: ownerUserId,
        name: 'Owner',
        email: 'owner@example.test',
        emailVerified: true,
        username: 'owner',
        role: 'owner',
        createdAt: nowDate,
        updatedAt: nowDate
      },
      {
        id: editorUserId,
        name: 'Editor',
        email: 'editor@example.test',
        emailVerified: true,
        username: 'editor',
        role: 'editor',
        createdAt: nowDate,
        updatedAt: nowDate
      },
      {
        id: viewerUserId,
        name: 'Viewer',
        email: 'viewer@example.test',
        emailVerified: true,
        username: 'viewer',
        role: 'viewer',
        createdAt: nowDate,
        updatedAt: nowDate
      }
    ])
    .run();

  db.insert(families)
    .values({
      id: familyId,
      name: 'Test Family',
      ownerUserId,
      createdAt: now,
      updatedAt: now
    })
    .run();

  db.insert(familyMembers)
    .values([
      { id: ownerMemberId, familyId, userId: ownerUserId, role: 'owner', joinedAt: now },
      { id: editorMemberId, familyId, userId: editorUserId, role: 'editor', joinedAt: now + 1 },
      { id: viewerMemberId, familyId, userId: viewerUserId, role: 'viewer', joinedAt: now + 2 }
    ])
    .run();

  db.insert(babies)
    .values([
      {
        id: babyAId,
        familyId,
        name: 'Baby A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: babyBId,
        familyId,
        name: 'Baby B',
        birthday: '2025-01-01',
        gender: 'boy',
        status: 'active',
        createdAt: now + 1,
        updatedAt: now + 1
      },
      {
        id: trashedBabyId,
        familyId,
        name: 'Trashed',
        birthday: '2023-01-01',
        gender: 'other',
        status: 'trashed',
        createdAt: now + 2,
        updatedAt: now + 2
      }
    ])
    .run();

  return {
    db,
    familyId,
    editorMemberId,
    viewerMemberId,
    babyAId,
    babyBId
  };
}

describe('permissions queries', () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it('lists non-owner members across active babies with nullable overrides', async () => {
    const ctx = seed();
    ctx.db
      .insert(babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyAId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 1,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    const { listPermissions } = await import('./permissions');
    const rows = listPermissions({ db: ctx.db, familyId: ctx.familyId });

    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.member.id === ctx.editorMemberId && row.baby.id === ctx.babyAId))
      .toMatchObject({ override: null });
    expect(rows.find((row) => row.member.id === ctx.viewerMemberId && row.baby.id === ctx.babyAId))
      .toMatchObject({ override: { canRead: 1, canWrite: 0, canDelete: 0 } });
  });

  it('upserts a non-empty override by baby and member', async () => {
    const ctx = seed();
    const { upsertPermission } = await import('./permissions');

    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.editorMemberId,
      babyId: ctx.babyAId,
      override: { canRead: 1, canWrite: 0, canDelete: 0 }
    });
    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.editorMemberId,
      babyId: ctx.babyAId,
      override: { canRead: 1, canWrite: 1, canDelete: 0 }
    });

    const rows = ctx.db.select().from(babyMemberPermissions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ canRead: 1, canWrite: 1, canDelete: 0 });
  });

  it('keeps an all-zero override row to deny access', async () => {
    const ctx = seed();
    const { upsertPermission } = await import('./permissions');

    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.editorMemberId,
      babyId: ctx.babyAId,
      override: { canRead: 1, canWrite: 0, canDelete: 0 }
    });
    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.editorMemberId,
      babyId: ctx.babyAId,
      override: { canRead: 0, canWrite: 0, canDelete: 0 }
    });

    expect(ctx.db.select().from(babyMemberPermissions).all()).toMatchObject([
      { familyMemberId: ctx.editorMemberId, babyId: ctx.babyAId, canRead: 0, canWrite: 0, canDelete: 0 }
    ]);
  });

  it('resets all overrides for one member only', async () => {
    const ctx = seed();
    const { resetMember, upsertPermission } = await import('./permissions');

    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.editorMemberId,
      babyId: ctx.babyAId,
      override: { canRead: 1, canWrite: 0, canDelete: 0 }
    });
    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.viewerMemberId,
      babyId: ctx.babyBId,
      override: { canRead: 1, canWrite: 0, canDelete: 0 }
    });

    resetMember({ db: ctx.db, familyMemberId: ctx.editorMemberId });

    expect(ctx.db.select().from(babyMemberPermissions).all()).toMatchObject([
      { familyMemberId: ctx.viewerMemberId, babyId: ctx.babyBId }
    ]);
  });

  it('lists only babies the member can read after overrides', async () => {
    const ctx = seed();
    const { listReadableBabies, upsertPermission } = await import('./permissions');

    upsertPermission({
      db: ctx.db,
      familyMemberId: ctx.viewerMemberId,
      babyId: ctx.babyBId,
      override: { canRead: 0, canWrite: 0, canDelete: 0 }
    });

    expect(
      listReadableBabies({
        db: ctx.db,
        familyId: ctx.familyId,
        familyMemberId: ctx.viewerMemberId,
        role: 'viewer',
        userId: 'viewer-id'
      }).map((baby) => baby.id)
    ).toEqual([ctx.babyAId]);
  });
});
