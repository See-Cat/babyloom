import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it('creates the owner user if no user exists', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('alice');
    expect(rows[0].role).toBe('owner');
    expect(rows[0].passwordHash).not.toBe('longenoughpw');
    expect(rows[0].passwordHash.length).toBeGreaterThan(20);
  });

  it('is idempotent — second call does not create duplicate', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    expect(db.select().from(users).all()).toHaveLength(1);
  });

  it('updates the owner password if config.yaml changed', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    const firstHash = db.select().from(users).all()[0].passwordHash;

    // Rewrite config with new password
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

    const secondHash = db.select().from(users).all()[0].passwordHash;
    expect(secondHash).not.toBe(firstHash);
  });
});
