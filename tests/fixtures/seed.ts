import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function seedOwnerBabyEntries(dataDir: string) {
  writeFileSync(
    join(dataDir, 'config.yaml'),
    `
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
`
  );
  const { resetDbForTesting } = await import('@/lib/server/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/server/db/client');
  const { users, families, babies, entries } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });

  const owner = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const babyId = randomUUID();
  const trashedBabyId = randomUUID();
  const now = Date.now();
  db.insert(babies)
    .values([
      {
        id: babyId,
        familyId: family.id,
        name: 'Baby A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: trashedBabyId,
        familyId: family.id,
        name: 'Baby T',
        birthday: '2024-01-01',
        gender: 'boy',
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: owner.id
      }
    ])
    .run();

  const activeEntryId = randomUUID();
  const trashedEntryId = randomUUID();
  const hiddenByParentEntryId = randomUUID();
  db.insert(entries)
    .values([
      {
        id: activeEntryId,
        babyId,
        authorId: owner.id,
        content: 'active',
        occurredAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: trashedEntryId,
        babyId,
        authorId: owner.id,
        content: 'trashed',
        occurredAt: now,
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: owner.id
      },
      {
        id: hiddenByParentEntryId,
        babyId: trashedBabyId,
        authorId: owner.id,
        content: 'hidden by parent',
        occurredAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }
    ])
    .run();

  return {
    ownerId: owner.id,
    babyId,
    activeBabyId: babyId,
    trashedBabyId,
    activeEntryId,
    trashedEntryId,
    hiddenByParentEntryId
  };
}
