import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { runMigrations } from '@/lib/server/db/migrate';
import { getDb, resetDbForTesting } from '@/lib/server/db/client';
import { babies, families, familyMembers, users } from '@/lib/server/db/schema';
import {
  batchUpsertMemberPermissions,
  listMemberBabyPermissions,
  listReadableBabies
} from '@/lib/server/db/queries/permissions';

function seed() {
  const dataDir = mkdtempSync(join(tmpdir(), 'babyloom-permissions-q-'));
  resetDbForTesting();
  runMigrations(dataDir);
  const { db } = getDb({ dataDir });

  const now = Date.now();
  const nowDate = new Date(now);
  const familyId = randomUUID();
  const ownerUserId = randomUUID();
  const memberUserId = randomUUID();
  const ownerMemberId = randomUUID();
  const memberId = randomUUID();
  const babyAId = randomUUID();
  const babyBId = randomUUID();

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
        id: memberUserId,
        name: 'Member',
        email: 'member@example.test',
        emailVerified: true,
        username: 'member',
        role: 'member',
        createdAt: nowDate,
        updatedAt: nowDate
      }
    ])
    .run();

  db.insert(families)
    .values({ id: familyId, name: 'F', ownerUserId, createdAt: now, updatedAt: now })
    .run();

  db.insert(familyMembers)
    .values([
      { id: ownerMemberId, familyId, userId: ownerUserId, role: 'owner', joinedAt: now },
      { id: memberId, familyId, userId: memberUserId, role: 'member', joinedAt: now + 1 }
    ])
    .run();

  db.insert(babies)
    .values([
      {
        id: babyAId,
        familyId,
        name: 'A',
        birthday: '2024-01-01',
        gender: 'other',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: babyBId,
        familyId,
        name: 'B',
        birthday: '2024-01-01',
        gender: 'other',
        status: 'active',
        createdAt: now + 1,
        updatedAt: now + 1
      }
    ])
    .run();

  return { db, familyId, memberId, memberUserId, babyAId, babyBId };
}

describe('listMemberBabyPermissions', () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it('returns empty array when no rows', () => {
    const ctx = seed();
    expect(listMemberBabyPermissions({ db: ctx.db, familyMemberId: ctx.memberId })).toEqual([]);
  });

  it('returns rows for active babies with permission label', () => {
    const ctx = seed();
    batchUpsertMemberPermissions({
      db: ctx.db,
      familyMemberId: ctx.memberId,
      babyIds: [ctx.babyAId, ctx.babyBId],
      permission: 'editor'
    });
    const rows = listMemberBabyPermissions({ db: ctx.db, familyMemberId: ctx.memberId });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.permission === 'editor')).toBe(true);
  });

  it('omits trashed babies', () => {
    const ctx = seed();
    batchUpsertMemberPermissions({
      db: ctx.db,
      familyMemberId: ctx.memberId,
      babyIds: [ctx.babyAId, ctx.babyBId],
      permission: 'viewer'
    });
    ctx.db.update(babies).set({ status: 'trashed' }).where(eq(babies.id, ctx.babyBId)).run();
    const rows = listMemberBabyPermissions({ db: ctx.db, familyMemberId: ctx.memberId });
    expect(rows.map((r) => r.babyId)).toEqual([ctx.babyAId]);
  });
});

describe('batchUpsertMemberPermissions', () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it('writes new rows', () => {
    const ctx = seed();
    batchUpsertMemberPermissions({
      db: ctx.db,
      familyMemberId: ctx.memberId,
      babyIds: [ctx.babyAId],
      permission: 'viewer'
    });
    const rows = listMemberBabyPermissions({ db: ctx.db, familyMemberId: ctx.memberId });
    expect(rows[0]).toMatchObject({ babyId: ctx.babyAId, permission: 'viewer' });
  });

  it('overwrites existing row', () => {
    const ctx = seed();
    batchUpsertMemberPermissions({
      db: ctx.db,
      familyMemberId: ctx.memberId,
      babyIds: [ctx.babyAId],
      permission: 'viewer'
    });
    batchUpsertMemberPermissions({
      db: ctx.db,
      familyMemberId: ctx.memberId,
      babyIds: [ctx.babyAId],
      permission: 'editor'
    });
    const rows = listMemberBabyPermissions({ db: ctx.db, familyMemberId: ctx.memberId });
    expect(rows).toHaveLength(1);
    expect(rows[0].permission).toBe('editor');
  });
});

describe('listReadableBabies strict', () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it('returns empty for member without any permission rows', () => {
    const ctx = seed();
    const out = listReadableBabies({
      db: ctx.db,
      familyId: ctx.familyId,
      familyMemberId: ctx.memberId,
      role: 'member',
      userId: ctx.memberUserId
    });
    expect(out).toEqual([]);
  });
});
