import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { getDb } from '../../lib/server/db/client';
import { users, accounts, families, babies } from '../../lib/server/db/schema';
import { hashPassword, ownerInternalEmail } from '../../lib/server/bootstrap/owner';

export async function seedE2eExtras() {
  const dataDir = resolve(process.cwd(), 'test-data/e2e');
  process.env.BABYLOOM_DATA_DIR = dataDir;

  const { db } = getDb({ dataDir });

  const owner = db.select().from(users).all().find((u: any) => u.role === 'owner');
  if (!owner) throw new Error('owner not bootstrapped — run global-setup first');
  const family = db.select().from(families).all()[0];

  let baby = db.select().from(babies).all()[0];
  if (!baby) {
    const id = randomUUID();
    db.insert(babies)
      .values({
        id,
        familyId: family.id,
        name: 'E2E Baby',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();
    baby = db.select().from(babies).all()[0];
  }

  const strangerUsername = 'stranger';
  const strangerPassword = 'strangerpw1';
  const strangerEmail = ownerInternalEmail(strangerUsername);

  let stranger = db.select().from(users).all().find((u: any) => u.username === strangerUsername);
  if (!stranger) {
    const id = randomUUID();
    const now = new Date();
    db.insert(users)
      .values({
        id,
        name: 'Stranger',
        email: strangerEmail,
        emailVerified: true,
        username: strangerUsername,
        role: 'editor',
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(accounts)
      .values({
        id: randomUUID(),
        userId: id,
        providerId: 'credential',
        accountId: strangerEmail,
        password: hashPassword(strangerPassword),
        createdAt: now,
        updatedAt: now
      })
      .run();
    stranger = db.select().from(users).all().find((u: any) => u.username === strangerUsername);
  }

  return {
    babyId: baby.id,
    strangerCreds: { email: strangerEmail, password: strangerPassword }
  };
}

export async function resetE2eDomainData() {
  const dataDir = resolve(process.cwd(), 'test-data/e2e');
  process.env.BABYLOOM_DATA_DIR = dataDir;

  const { resetDbForTesting, getDb } = await import('../../lib/server/db/client');
  resetDbForTesting();
  const { db } = getDb({ dataDir });
  const { babies, babyMemberPermissions, entries, entryMilestones, entryMedia } =
    await import('../../lib/server/db/schema');

  db.delete(entryMedia).run();
  db.delete(entryMilestones).run();
  db.delete(entries).run();
  db.delete(babyMemberPermissions).run();
  db.delete(babies).run();
}
