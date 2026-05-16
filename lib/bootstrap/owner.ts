import { eq, and } from 'drizzle-orm';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { users, accounts } from '@/lib/db/schema';
import { loadConfig } from '@/lib/config/load';

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
  const passwordHash = hashPassword(config.owner.password);
  const internalEmail = ownerInternalEmail(config.owner.username);

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
    return;
  }

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
}
