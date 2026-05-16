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
  email: alice@example.com
  displayName: Alice
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

    const accountRows = db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userRows[0].id))
      .all();
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].providerId).toBe('credential');
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
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    await bootstrapOwner({ dataDir });

    const secondHash = db.select().from(accounts).all()[0].password;
    expect(secondHash).not.toBe(firstHash);
  });
});
