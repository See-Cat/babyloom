import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { getDb, resetDbForTesting } from '@/lib/server/db/client';
import { runMigrations } from '@/lib/server/db/migrate';
import { babies, entries, entryMedia, families, media, users } from '@/lib/server/db/schema';
import { runReconcileOnce } from '@/lib/server/media/reconcile';

const HOUR_MS = 60 * 60 * 1000;

let dataDir: string;

function insertMedia(args: {
  id: string;
  babyId: string;
  origin: 'standalone' | 'entry_draft';
  status: string;
  createdAt: number;
}): void {
  const { db } = getDb({ dataDir });
  db.insert(media)
    .values({
      id: args.id,
      babyId: args.babyId,
      uploadedBy: 'u1',
      clientUploadId: `c-${args.id}`,
      origin: args.origin,
      status: args.status,
      filename: 'x',
      createdAt: args.createdAt,
      updatedAt: args.createdAt
    })
    .run();
}

function attachMedia(entryId: string, mediaId: string, babyId: string): void {
  const { db } = getDb({ dataDir });
  const now = Date.now();
  db.insert(entries)
    .values({
      id: entryId,
      babyId,
      authorId: 'u1',
      content: 'hi',
      occurredAt: now,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(entryMedia)
    .values({ entryId, mediaId, attachedBy: 'u1', attachedAt: now })
    .run();
}

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

  test('trashes an entry-draft orphan older than 24h with no entry_media', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const now = Date.now();
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 25 * HOUR_MS });
    await runReconcileOnce({ dataDir, nowMs: now });
    const after = db.select().from(media).where(eq(media.id, 'orphan')).get();
    expect(after?.status).toBe('trashed');
    expect(after?.deletedAt).toBe(now);
  });

  test('keeps a standalone (bulk-uploaded) orphan even when old and unattached', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const now = Date.now();
    insertMedia({ id: 'bulk', babyId: 'b1', origin: 'standalone', status: 'ready', createdAt: now - 100 * HOUR_MS });
    await runReconcileOnce({ dataDir, nowMs: now });
    const after = db.select({ status: media.status }).from(media).where(eq(media.id, 'bulk')).get();
    expect(after?.status).toBe('ready');
  });

  test('keeps an entry-draft media that is attached to an entry', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const now = Date.now();
    insertMedia({ id: 'attached', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 25 * HOUR_MS });
    attachMedia('e1', 'attached', 'b1');
    await runReconcileOnce({ dataDir, nowMs: now });
    const after = db.select({ status: media.status }).from(media).where(eq(media.id, 'attached')).get();
    expect(after?.status).toBe('ready');
  });

  test('keeps a recent (<24h) entry-draft orphan', async () => {
    seedBaby('b1');
    const { db } = getDb({ dataDir });
    const now = Date.now();
    insertMedia({ id: 'recent', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 1 * HOUR_MS });
    await runReconcileOnce({ dataDir, nowMs: now });
    const after = db.select({ status: media.status }).from(media).where(eq(media.id, 'recent')).get();
    expect(after?.status).toBe('ready');
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
