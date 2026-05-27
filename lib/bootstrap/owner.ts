import { eq, and } from 'drizzle-orm';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { users, accounts, families, familyMembers } from '@/lib/db/schema';
import { loadConfig } from '@/lib/config/load';
import { seedDefaultMilestones } from './default-milestones';

export interface BootstrapOwnerOptions {
  dataDir: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function ownerInternalEmail(username: string): string {
  return `${username}@local.babyloom`;
}

export async function bootstrapOwner(opts: BootstrapOwnerOptions): Promise<void> {
  const config = loadConfig({ dataDir: opts.dataDir });
  const { db } = getDb({ dataDir: opts.dataDir });

  const existing = db.select().from(users).where(eq(users.role, 'owner')).all();
  const now = new Date();
  const nowMs = Date.now();
  const passwordHash = hashPassword(config.owner.password);
  const internalEmail = ownerInternalEmail(config.owner.username);
  let ownerUserId: string;

  if (existing.length === 0) {
    const userId = randomUUID();
    db.insert(users)
      .values({
        id: userId,
        name: config.owner.nickname,
        email: internalEmail,
        emailVerified: true,
        username: config.owner.username,
        role: 'owner',
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(accounts)
      .values({
        id: randomUUID(),
        userId,
        providerId: 'credential',
        accountId: internalEmail,
        password: passwordHash,
        createdAt: now,
        updatedAt: now
      })
      .run();
    ownerUserId = userId;
  } else {
    const owner = existing[0];
    db.update(users)
      .set({
        name: config.owner.nickname,
        email: internalEmail,
        username: config.owner.username,
        updatedAt: now
      })
      .where(eq(users.id, owner.id))
      .run();

    const credAccount = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, owner.id), eq(accounts.providerId, 'credential')))
      .all();
    if (credAccount.length === 0) {
      db.insert(accounts)
        .values({
          id: randomUUID(),
          userId: owner.id,
          providerId: 'credential',
          accountId: internalEmail,
          password: passwordHash,
          createdAt: now,
          updatedAt: now
        })
        .run();
    } else {
      db.update(accounts)
        .set({
          accountId: internalEmail,
          password: passwordHash,
          updatedAt: now
        })
        .where(eq(accounts.id, credAccount[0].id))
        .run();
    }
    ownerUserId = owner.id;
  }

  const existingFamilies = db.select().from(families).all();
  let familyId: string;
  if (existingFamilies.length === 0) {
    familyId = randomUUID();
    db.insert(families)
      .values({
        id: familyId,
        name: config.family.name,
        ownerUserId,
        createdAt: nowMs,
        updatedAt: nowMs
      })
      .run();
  } else {
    familyId = existingFamilies[0].id;
    db.update(families)
      .set({
        name: config.family.name,
        ownerUserId,
        updatedAt: nowMs
      })
      .where(eq(families.id, familyId))
      .run();
  }

  const existingMember = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, ownerUserId))
    .all();

  if (existingMember.length === 0) {
    db.insert(familyMembers)
      .values({
        id: randomUUID(),
        familyId,
        userId: ownerUserId,
        role: 'owner',
        joinedAt: nowMs
      })
      .run();
  } else {
    db.update(familyMembers)
      .set({ familyId, role: 'owner' })
      .where(eq(familyMembers.id, existingMember[0].id))
      .run();
  }

  seedDefaultMilestones(db, familyId);
}
