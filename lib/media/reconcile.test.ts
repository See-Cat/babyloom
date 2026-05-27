import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { getDb, resetDbForTesting } from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { babies, families, media, users } from '@/lib/db/schema';
import { runReconcileOnce } from '@/lib/media/reconcile';

let dataDir: string;

function seedBaby(babyId: string) {
  const { db } = getDb({ dataDir });
  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  db.insert(users)
    .values({
      id: 'u1',
      name: 'U',
      email: 'u@x.test',
      emailVerified: true,
      createdAt: nowDate,
      updatedAt: nowDate,
      username: 'u1',
      role: 'owner'
    })
    .run();
  db.insert(families)
    .values({ id: 'f1', name: 'F', ownerUserId: 'u1', createdAt: nowMs, updatedAt: nowMs })
    .run();
  db.insert(babies)
    .values({
      id: babyId,
      familyId: 'f1',
      name: 'B',
      birthday: '2025-01-01',
      gender: 'other',
      status: 'active',
      createdAt: nowMs,
      updatedAt: nowMs
    })
    .run();
}

beforeEach(() => {
  resetDbForTesting();
  dataDir = mkdtempSync(join(tmpdir(), 'reconcile-'));
  runMigrations(dataDir);
});

describe('reconcile', () => {
  test('marks stuck pending older than 1h as failed', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    db.insert(media)
      .values({
        id: 'm1',
        babyId: 'b1',
        uploadedBy: 'u1',
        clientUploadId: 'c1',
        status: 'pending',
        filename: 'x',
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo
      })
      .run();
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    const after = db.select({ status: media.status }).from(media).where(eq(media.id, 'm1')).get();
    expect(after?.status).toBe('failed');
  });

  test('leaves recent pending rows alone', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const recent = Date.now() - 60_000;
    db.insert(media)
      .values({
        id: 'm2',
        babyId: 'b1',
        uploadedBy: 'u1',
        clientUploadId: 'c2',
        status: 'pending',
        filename: 'x',
        createdAt: recent,
        updatedAt: recent
      })
      .run();
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    const after = db.select({ status: media.status }).from(media).where(eq(media.id, 'm2')).get();
    expect(after?.status).toBe('pending');
  });

  test('removes staging dirs with no matching DB row', async () => {
    const staging = join(dataDir, 'media', '_staging', 'orphan-1');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'raw.bin'), 'x');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    expect(existsSync(staging)).toBe(false);
  });

  test('keeps staging dirs whose mediaId still has a non-terminal row', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    db.insert(media)
      .values({
        id: 'live-1',
        babyId: 'b1',
        uploadedBy: 'u1',
        clientUploadId: 'cx',
        status: 'pending',
        filename: 'x',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();
    const staging = join(dataDir, 'media', '_staging', 'live-1');
    mkdirSync(staging, { recursive: true });
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    expect(existsSync(staging)).toBe(true);
  });
});
