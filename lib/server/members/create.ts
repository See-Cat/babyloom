import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { accounts, babies, babyMemberPermissions, familyMembers, users } from '@/lib/server/db/schema';
import { hashPassword, ownerInternalEmail } from '@/lib/server/bootstrap/owner';
import { permissionToBits } from '@/lib/server/db/queries/permissions';
import { pickAvatarColor } from '@/lib/server/members/avatar-color';

export interface CreateMemberOpts {
  dataDir: string;
  familyId: string;
  username: string;
  password: string;
  nickname: string;
  role: 'owner' | 'member';
  babyAssociations?: {
    babyIds: string[];
    permission: 'viewer' | 'editor';
  };
}

export interface CreateMemberResult {
  userId: string;
  memberId: string;
  email: string;
}

/**
 * Creates a user + credential account + family_members row in a single
 * transaction. Returns the generated ids. Throws if username already exists.
 *
 * The dual-write to users+accounts is the spec §3.2 invariant — never call
 * db.insert(users) for a new account without also inserting
 * accounts(providerId='credential').
 */
export async function createMember(opts: CreateMemberOpts): Promise<CreateMemberResult> {
  const { db } = getDb({ dataDir: opts.dataDir });

  const existingByUsername = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, opts.username))
    .get();
  if (existingByUsername) {
    throw new Error('username_taken');
  }

  const userId = randomUUID();
  const memberId = randomUUID();
  const email = ownerInternalEmail(opts.username);
  const now = new Date();
  const nowMs = Date.now();
  const passwordHash = hashPassword(opts.password);

  db.transaction((tx) => {
    const usedAvatarColors = tx
      .select({ avatarColor: users.avatarColor })
      .from(familyMembers)
      .innerJoin(users, eq(users.id, familyMembers.userId))
      .where(eq(familyMembers.familyId, opts.familyId))
      .all()
      .map((row) => row.avatarColor);
    const avatarColor = pickAvatarColor(usedAvatarColors);

    tx.insert(users)
      .values({
        id: userId,
        name: opts.nickname,
        email,
        emailVerified: true,
        username: opts.username,
        role: opts.role,
        avatarColor,
        createdAt: now,
        updatedAt: now
      })
      .run();
    tx.insert(accounts)
      .values({
        id: randomUUID(),
        userId,
        providerId: 'credential',
        accountId: email,
        password: passwordHash,
        createdAt: now,
        updatedAt: now
      })
      .run();
    tx.insert(familyMembers)
      .values({
        id: memberId,
        familyId: opts.familyId,
        userId,
        role: opts.role,
        joinedAt: nowMs
      })
      .run();

    if (opts.babyAssociations && opts.babyAssociations.babyIds.length > 0) {
      const bits = permissionToBits(opts.babyAssociations.permission);
      const owned = tx
        .select({ id: babies.id })
        .from(babies)
        .where(
          and(
            eq(babies.familyId, opts.familyId),
            eq(babies.status, 'active'),
            inArray(babies.id, opts.babyAssociations.babyIds)
          )
        )
        .all();
      if (owned.length !== opts.babyAssociations.babyIds.length) {
        throw new Error('invalid_baby_id');
      }
      for (const babyId of opts.babyAssociations.babyIds) {
        tx.insert(babyMemberPermissions)
          .values({
            id: randomUUID(),
            familyMemberId: memberId,
            babyId,
            canRead: bits.canRead,
            canWrite: bits.canWrite,
            canDelete: bits.canDelete
          })
          .run();
      }
    }
  });

  return { userId, memberId, email };
}

/**
 * Resets a member's credential password. Touches accounts.password only.
 */
export function resetMemberPassword(opts: {
  dataDir: string;
  userId: string;
  newPassword: string;
}): void {
  const { db } = getDb({ dataDir: opts.dataDir });
  const passwordHash = hashPassword(opts.newPassword);
  const now = new Date();

  const cred = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, opts.userId), eq(accounts.providerId, 'credential')))
    .get();
  if (!cred) throw new Error('no_credential_account');

  db.update(accounts)
    .set({ password: passwordHash, updatedAt: now })
    .where(eq(accounts.id, cred.id))
    .run();
}
