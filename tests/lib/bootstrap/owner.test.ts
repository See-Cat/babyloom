import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

describe('bootstrapOwner', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-bootstrap-'));
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: longenoughpw
  nickname: Alice
family:
  name: Alice Home
app:
  baseUrl: http://localhost:3000
  secret: local-test-secret-123456789012345
  timezone: Asia/Shanghai
log:
  level: info
`);
    const { resetDbForTesting } = await import('@/lib/db/client');
    const { clearConfigCache } = await import('@/lib/config/load');
    resetDbForTesting();
    clearConfigCache();
    const { runMigrations } = await import('@/lib/db/migrate');
    runMigrations(dataDir);
  });

  it('creates the owner user + credential account if no user exists', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users, accounts } = await import('@/lib/db/schema');
    const userRows = db.select().from(users).all();
    expect(userRows).toHaveLength(1);
    expect(userRows[0].username).toBe('alice');
    expect(userRows[0].role).toBe('owner');
    expect(userRows[0].name).toBe('Alice');
    expect(userRows[0].email).toBe('alice@local.babyloom');

    const accountRows = db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userRows[0].id))
      .all();
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].providerId).toBe('credential');
    expect(accountRows[0].accountId).toBe('alice@local.babyloom');
    expect(accountRows[0].password).not.toBe('longenoughpw');
    expect(accountRows[0].password!.length).toBeGreaterThan(20);
  });

  it('is idempotent — second call does not create duplicate', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users, accounts } = await import('@/lib/db/schema');
    expect(db.select().from(users).all()).toHaveLength(1);
    expect(db.select().from(accounts).all()).toHaveLength(1);
  });

  it('updates the owner password if config.yaml changed', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { accounts } = await import('@/lib/db/schema');
    const firstHash = db.select().from(accounts).all()[0].password;

    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: brandnewpassword
  nickname: Alice
family:
  name: Alice Home
app:
  secret: local-test-secret-123456789012345
log:
  level: info
`);
    await bootstrapOwner({ dataDir });

    const secondHash = db.select().from(accounts).all()[0].password;
    expect(secondHash).not.toBe(firstHash);
  });

  it('updates username and internal email without creating a new owner', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: bob
  password: longenoughpw
  nickname: Bob
family:
  name: Bob Home
app:
  secret: local-test-secret-123456789012345
`);
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users, accounts } = await import('@/lib/db/schema');
    const userRows = db.select().from(users).all();
    const accountRows = db.select().from(accounts).all();
    expect(userRows).toHaveLength(1);
    expect(userRows[0].username).toBe('bob');
    expect(userRows[0].email).toBe('bob@local.babyloom');
    expect(userRows[0].name).toBe('Bob');
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].accountId).toBe('bob@local.babyloom');
  });
});
