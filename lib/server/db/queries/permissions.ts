import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { babies, babyMemberPermissions, familyMembers, users } from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

export interface PermissionBits {
  canRead: number;
  canWrite: number;
  canDelete: number;
}

export interface PermissionMatrixRow {
  member: {
    id: string;
    userId: string;
    username: string;
    nickname: string;
    role: 'member';
  };
  baby: {
    id: string;
    name: string;
  };
  override: PermissionBits | null;
}

export type Permission = 'viewer' | 'editor';

export function permissionToBits(p: Permission): PermissionBits {
  return p === 'editor'
    ? { canRead: 1, canWrite: 1, canDelete: 1 }
    : { canRead: 1, canWrite: 0, canDelete: 0 };
}

export function bitsToPermission(bits: PermissionBits): Permission {
  if (bits.canWrite === 1 && bits.canDelete === 1) return 'editor';
  return 'viewer';
}

export interface MemberBabyPermissionRow {
  babyId: string;
  babyName: string;
  babyAvatarUrl: string | null;
  permission: Permission;
}

export function listMemberBabyPermissions(opts: {
  db: Db;
  familyMemberId: string;
}): MemberBabyPermissionRow[] {
  const rows = opts.db
    .select({
      babyId: babies.id,
      babyName: babies.name,
      babyAvatarUrl: babies.avatarUrl,
      canRead: babyMemberPermissions.canRead,
      canWrite: babyMemberPermissions.canWrite,
      canDelete: babyMemberPermissions.canDelete
    })
    .from(babyMemberPermissions)
    .innerJoin(babies, eq(babies.id, babyMemberPermissions.babyId))
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        eq(babies.status, 'active')
      )
    )
    .orderBy(babies.createdAt)
    .all();
  return rows.map((r) => ({
    babyId: r.babyId,
    babyName: r.babyName,
    babyAvatarUrl: r.babyAvatarUrl,
    permission: bitsToPermission({
      canRead: r.canRead,
      canWrite: r.canWrite,
      canDelete: r.canDelete
    })
  }));
}

export function batchUpsertMemberPermissions(opts: {
  db: Db;
  familyMemberId: string;
  babyIds: string[];
  permission: Permission;
}): void {
  const bits = permissionToBits(opts.permission);
  opts.db.transaction((tx) => {
    for (const babyId of opts.babyIds) {
      tx.insert(babyMemberPermissions)
        .values({
          id: randomUUID(),
          familyMemberId: opts.familyMemberId,
          babyId,
          canRead: bits.canRead,
          canWrite: bits.canWrite,
          canDelete: bits.canDelete
        })
        .onConflictDoUpdate({
          target: [babyMemberPermissions.babyId, babyMemberPermissions.familyMemberId],
          set: bits
        })
        .run();
    }
  });
}

export function listPermissions(opts: { db: Db; familyId: string }): PermissionMatrixRow[] {
  const members = opts.db
    .select({
      id: familyMembers.id,
      userId: familyMembers.userId,
      username: users.username,
      nickname: users.name,
      role: familyMembers.role
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(and(eq(familyMembers.familyId, opts.familyId), ne(familyMembers.role, 'owner')))
    .orderBy(familyMembers.joinedAt)
    .all();

  const activeBabies = opts.db
    .select({ id: babies.id, name: babies.name })
    .from(babies)
    .where(and(eq(babies.familyId, opts.familyId), eq(babies.status, 'active')))
    .orderBy(babies.createdAt)
    .all();

  if (members.length === 0 || activeBabies.length === 0) return [];

  const overrides = opts.db
    .select()
    .from(babyMemberPermissions)
    .where(
      and(
        inArray(
          babyMemberPermissions.familyMemberId,
          members.map((member) => member.id)
        ),
        inArray(
          babyMemberPermissions.babyId,
          activeBabies.map((baby) => baby.id)
        )
      )
    )
    .all();

  const byPair = new Map(
    overrides.map((override) => [
      `${override.familyMemberId}:${override.babyId}`,
      {
        canRead: override.canRead,
        canWrite: override.canWrite,
        canDelete: override.canDelete
      }
    ])
  );

  return members.flatMap((member) =>
    activeBabies.map((baby) => ({
      member: {
        id: member.id,
        userId: member.userId,
        username: member.username,
        nickname: member.nickname,
        role: 'member' as const
      },
      baby,
      override: byPair.get(`${member.id}:${baby.id}`) ?? null
    }))
  );
}

export function upsertPermission(opts: {
  db: Db;
  familyMemberId: string;
  babyId: string;
  override: PermissionBits;
}) {
  opts.db
    .insert(babyMemberPermissions)
    .values({
      id: randomUUID(),
      familyMemberId: opts.familyMemberId,
      babyId: opts.babyId,
      canRead: opts.override.canRead,
      canWrite: opts.override.canWrite,
      canDelete: opts.override.canDelete
    })
    .onConflictDoUpdate({
      target: [babyMemberPermissions.babyId, babyMemberPermissions.familyMemberId],
      set: {
        canRead: opts.override.canRead,
        canWrite: opts.override.canWrite,
        canDelete: opts.override.canDelete
      }
    })
    .run();
}

export function clearPermissionRow(opts: { db: Db; familyMemberId: string; babyId: string }) {
  opts.db
    .delete(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        eq(babyMemberPermissions.babyId, opts.babyId)
      )
    )
    .run();
}

export function resetMember(opts: { db: Db; familyMemberId: string }) {
  opts.db
    .delete(babyMemberPermissions)
    .where(eq(babyMemberPermissions.familyMemberId, opts.familyMemberId))
    .run();
}

export function canWriteToBaby(opts: {
  db: Db;
  familyMemberId: string;
  role: 'owner' | 'member';
  babyId: string;
}): boolean {
  if (opts.role === 'owner') return true;
  const row = opts.db
    .select({ canWrite: babyMemberPermissions.canWrite })
    .from(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        eq(babyMemberPermissions.babyId, opts.babyId)
      )
    )
    .get();
  return row?.canWrite === 1;
}

export function listReadableBabies(opts: {
  db: Db;
  familyId: string;
  familyMemberId: string;
  role: 'owner' | 'member';
  userId: string;
}) {
  const activeBabies = opts.db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, opts.familyId), eq(babies.status, 'active')))
    .orderBy(babies.createdAt)
    .all();
  if (opts.role === 'owner' || activeBabies.length === 0) return activeBabies;

  const overrides = opts.db
    .select()
    .from(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        inArray(
          babyMemberPermissions.babyId,
          activeBabies.map((baby) => baby.id)
        )
      )
    )
    .all();
  const readableIds = new Set(
    overrides.filter((o) => o.canRead === 1).map((o) => o.babyId)
  );
  return activeBabies.filter((baby) => readableIds.has(baby.id));
}
