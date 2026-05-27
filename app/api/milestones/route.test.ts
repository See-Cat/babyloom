import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

function req(method: string): any {
  return new Request('http://localhost/api/milestones/id', { method });
}

async function seedTwoFamilies(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Family One
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/server/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner, hashPassword, ownerInternalEmail } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/server/db/client');
  const { db } = getDb({ dataDir });
  const { users, accounts, families, familyMembers, milestones } = await import('@/lib/server/db/schema');
  const owner = db.select().from(users).where(eq(users.username, 'owner')).get()!;

  const now = new Date();
  const nowMs = Date.now();
  const otherOwnerId = randomUUID();
  const otherFamilyId = randomUUID();
  db.insert(users)
    .values({
      id: otherOwnerId,
      name: 'Other Owner',
      email: ownerInternalEmail('otherowner'),
      emailVerified: true,
      username: 'otherowner',
      role: 'owner',
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(accounts)
    .values({
      id: randomUUID(),
      userId: otherOwnerId,
      providerId: 'credential',
      accountId: ownerInternalEmail('otherowner'),
      password: hashPassword('otherpassword'),
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(families)
    .values({
      id: otherFamilyId,
      name: 'Family Two',
      ownerUserId: otherOwnerId,
      createdAt: nowMs,
      updatedAt: nowMs
    })
    .run();
  db.insert(familyMembers)
    .values({
      id: randomUUID(),
      familyId: otherFamilyId,
      userId: otherOwnerId,
      role: 'owner',
      joinedAt: nowMs
    })
    .run();
  const otherMilestoneId = randomUUID();
  db.insert(milestones)
    .values({
      id: otherMilestoneId,
      familyId: otherFamilyId,
      name: 'Other family milestone',
      icon: 'x',
      sortOrder: 0,
      createdAt: nowMs
    })
    .run();

  return { ownerId: owner.id, otherMilestoneId };
}

describe('/api/milestones/[id] family scoping', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-milestone-route-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('does not let one family owner delete another family milestone', async () => {
    const ctx = await seedTwoFamilies(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { DELETE } = await import('@/app/api/milestones/[id]/route');
    const { getDb } = await import('@/lib/server/db/client');
    const { milestones } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });

    const res = await DELETE(req('DELETE'), {
      params: Promise.resolve({ id: ctx.otherMilestoneId })
    });
    expect(res.status).toBe(404);
    expect(db.select().from(milestones).where(eq(milestones.id, ctx.otherMilestoneId)).get()).toBeTruthy();
  });
});
