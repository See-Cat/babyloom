import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

async function freshFamily(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
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
`);
  const { resetDbForTesting } = await import('@/lib/server/db/client');
  const { clearConfigCache } = await import('@/lib/server/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/server/bootstrap/owner');
  await bootstrapOwner({ dataDir });
  const { getDb } = await import('@/lib/server/db/client');
  const { db } = getDb({ dataDir });
  const { families } = await import('@/lib/server/db/schema');
  return { familyId: db.select().from(families).all()[0].id };
}

describe('createMember', () => {
  let dataDir: string;
  let familyId: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-create-member-'));
    ({ familyId } = await freshFamily(dataDir));
  });

  it('creates user + credential account + family_members in one go', async () => {
    const { createMember } = await import('@/lib/server/members/create');
    const { userId, memberId, email } = await createMember({
      dataDir,
      familyId,
      username: 'alice',
      password: 'alicepass',
      nickname: 'Alice',
      role: 'member'
    });
    expect(email).toBe('alice@local.babyloom');

    const { getDb } = await import('@/lib/server/db/client');
    const { db } = getDb({ dataDir });
    const { users, accounts, familyMembers } = await import('@/lib/server/db/schema');

    const u = db.select().from(users).where(eq(users.id, userId)).get();
    expect(u?.username).toBe('alice');
    expect(u?.role).toBe('member');

    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .get();
    expect(cred?.password).toBeTruthy();
    expect(cred?.accountId).toBe(email);

    const m = db.select().from(familyMembers).where(eq(familyMembers.id, memberId)).get();
    expect(m?.role).toBe('member');
    expect(m?.familyId).toBe(familyId);
  });

  it('rejects duplicate username', async () => {
    const { createMember } = await import('@/lib/server/members/create');
    await createMember({
      dataDir,
      familyId,
      username: 'alice',
      password: 'p1longenuf',
      nickname: 'A',
      role: 'member'
    });
    await expect(
      createMember({
        dataDir,
        familyId,
        username: 'alice',
        password: 'p2longenuf',
        nickname: 'A2',
        role: 'member'
      })
    ).rejects.toThrow(/username_taken/);
  });

  it('the created member can sign in with the chosen password', async () => {
    const { createMember } = await import('@/lib/server/members/create');
    const { verifyPassword } = await import('@/lib/server/bootstrap/owner');
    await createMember({
      dataDir,
      familyId,
      username: 'bob',
      password: 'bobsecure',
      nickname: 'Bob',
      role: 'member'
    });

    const { getDb } = await import('@/lib/server/db/client');
    const { db } = getDb({ dataDir });
    const { accounts, users } = await import('@/lib/server/db/schema');
    const u = db.select().from(users).where(eq(users.username, 'bob')).get();
    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, u!.id), eq(accounts.providerId, 'credential')))
      .get();
    expect(verifyPassword('bobsecure', cred!.password!)).toBe(true);
    expect(verifyPassword('wrong', cred!.password!)).toBe(false);
  });

  it('atomically writes baby associations when provided', async () => {
    const { createMember } = await import('@/lib/server/members/create');
    const { getDb } = await import('@/lib/server/db/client');
    const { db } = getDb({ dataDir });
    const { babies } = await import('@/lib/server/db/schema');
    const { listMemberBabyPermissions } = await import('@/lib/server/db/queries/permissions');

    const babyAId = randomUUID();
    const babyBId = randomUUID();
    const nowMs = Date.now();
    db.insert(babies)
      .values({
        id: babyAId,
        familyId,
        name: 'Baby A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: nowMs,
        updatedAt: nowMs
      })
      .run();
    db.insert(babies)
      .values({
        id: babyBId,
        familyId,
        name: 'Baby B',
        birthday: '2024-02-01',
        gender: 'boy',
        status: 'active',
        createdAt: nowMs,
        updatedAt: nowMs
      })
      .run();

    const result = await createMember({
      dataDir,
      familyId,
      username: 'grandpa',
      password: 'pw12345678',
      nickname: 'Grandpa',
      role: 'member',
      babyAssociations: { babyIds: [babyAId, babyBId], permission: 'editor' }
    });

    const rows = listMemberBabyPermissions({ db, familyMemberId: result.memberId });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.permission === 'editor')).toBe(true);
  });

  it('rolls back account creation when association write fails', async () => {
    const { createMember } = await import('@/lib/server/members/create');
    const { getDb } = await import('@/lib/server/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/server/db/schema');

    await expect(
      createMember({
        dataDir,
        familyId,
        username: 'will-fail',
        password: 'pw12345678',
        nickname: 'X',
        role: 'member',
        babyAssociations: {
          babyIds: ['00000000-0000-0000-0000-000000000000'],
          permission: 'viewer'
        }
      })
    ).rejects.toThrow();

    const u = db.select().from(users).where(eq(users.username, 'will-fail')).get();
    expect(u).toBeUndefined();
  });

  it('resetMemberPassword updates accounts.password only', async () => {
    const { createMember, resetMemberPassword } = await import('@/lib/server/members/create');
    const { verifyPassword } = await import('@/lib/server/bootstrap/owner');
    const { userId } = await createMember({
      dataDir,
      familyId,
      username: 'carol',
      password: 'oldlongenuf',
      nickname: 'C',
      role: 'member'
    });
    resetMemberPassword({ dataDir, userId, newPassword: 'newlongenuf' });

    const { getDb } = await import('@/lib/server/db/client');
    const { db } = getDb({ dataDir });
    const { accounts, users } = await import('@/lib/server/db/schema');
    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .get();
    expect(verifyPassword('newlongenuf', cred!.password!)).toBe(true);
    expect(verifyPassword('oldlongenuf', cred!.password!)).toBe(false);

    const u = db.select().from(users).where(eq(users.id, userId)).get();
    expect(u?.username).toBe('carol');
  });
});
