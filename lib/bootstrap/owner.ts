import { eq } from 'drizzle-orm';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
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

export async function bootstrapOwner(opts: BootstrapOwnerOptions): Promise<void> {
  const config = loadConfig({ dataDir: opts.dataDir });
  const { db } = getDb({ dataDir: opts.dataDir });

  const existing = db.select().from(users).where(eq(users.role, 'owner')).all();
  const now = Date.now();
  const passwordHash = hashPassword(config.owner.password);

  if (existing.length === 0) {
    db.insert(users)
      .values({
        id: randomUUID(),
        username: config.owner.username,
        email: config.owner.email,
        displayName: config.owner.displayName,
        role: 'owner',
        passwordHash,
        createdAt: now,
        updatedAt: now
      })
      .run();
    return;
  }

  const owner = existing[0];
  db.update(users)
    .set({
      username: config.owner.username,
      email: config.owner.email,
      displayName: config.owner.displayName,
      passwordHash,
      updatedAt: now
    })
    .where(eq(users.id, owner.id))
    .run();
}
