import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDb, resetDbForTesting } from '@/lib/server/db/client';
import { runMigrations } from '@/lib/server/db/migrate';
import { babies, entries, entryMedia, families, media, users } from '@/lib/server/db/schema';
import { runReconcileOnce } from '@/lib/server/media/reconcile';
import { setBackupInProgress } from '@/lib/server/backup/write-barrier';
import * as cleanupModule from '@/lib/server/settings/cleanup';
import {
  getCleanupSettings,
  recordCleanupRun,
  updateCleanupSettings
} from '@/lib/server/settings/cleanup';

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

describe('reconcile settings integration', () => {
  function statusOf(id: string): string | undefined {
    const { db } = getDb({ dataDir });
    return db.select({ status: media.status }).from(media).where(eq(media.id, id)).get()?.status;
  }

  test('with cleanup disabled, an old orphan is NOT trashed but hygiene still runs', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, enabled: false, nowMs: now });
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });
    insertMedia({ id: 'stuck', babyId: 'b1', origin: 'standalone', status: 'pending', createdAt: now - 2 * HOUR_MS });
    const staging = join(dataDir, 'media', '_staging', 'gone');
    mkdirSync(staging, { recursive: true });

    await runReconcileOnce({ dataDir, nowMs: now });

    expect(statusOf('orphan')).toBe('ready'); // cleanup skipped
    expect(statusOf('stuck')).toBe('failed'); // hygiene still runs
    expect(existsSync(staging)).toBe(false); // staging GC still runs
  });

  test('with cleanup enabled, an old orphan is trashed', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, enabled: true, nowMs: now });
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now });

    expect(statusOf('orphan')).toBe('trashed');
  });

  test('uses the configured threshold: 72h keeps a 30h-old orphan', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, thresholdHours: 72, nowMs: now });
    insertMedia({ id: 'young', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 30 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now });

    expect(statusOf('young')).toBe('ready');
  });

  test('uses the configured threshold: 24h trashes an older orphan', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, thresholdHours: 24, nowMs: now });
    insertMedia({ id: 'old', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 30 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now });

    expect(statusOf('old')).toBe('trashed');
  });

  test('records lastRunAt + lastRunDeleted after a run that performs cleanup', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'o1', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });
    insertMedia({ id: 'o2', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now });

    const s = getCleanupSettings({ dataDir });
    expect(s.lastRunAt).toBe(now);
    expect(s.lastRunDeleted).toBe(2);
  });

  test('manual mode trashes eligible orphans even when the DB enabled flag is OFF', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, enabled: false, nowMs: now });
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now, mode: 'manual' });

    expect(statusOf('orphan')).toBe('trashed');
  });

  test('scheduled mode with the DB enabled flag OFF does not trash', async () => {
    seedBaby('b1');
    const now = Date.now();
    updateCleanupSettings({ dataDir, enabled: false, nowMs: now });
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now, mode: 'scheduled' });

    expect(statusOf('orphan')).toBe('ready');
  });

  // The owner's "立即清理" (manual) is scoped to the orphan-draft cleanup the panel
  // describes; the internal hygiene (stuck-pending recovery + staging GC) is a
  // background concern that runs only on the scheduled tick. This keeps a manual
  // run from touching another member's still-processing upload + its staging dir.
  test('manual mode does NOT run hygiene: a >1h processing upload and its staging are left intact', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'inflight', babyId: 'b1', origin: 'entry_draft', status: 'processing', createdAt: now - 2 * HOUR_MS });
    const staging = join(dataDir, 'media', '_staging', 'inflight');
    mkdirSync(staging, { recursive: true });
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    await runReconcileOnce({ dataDir, nowMs: now, mode: 'manual' });

    expect(statusOf('inflight')).toBe('processing'); // not recovered to failed
    expect(existsSync(staging)).toBe(true); // staging not purged
    expect(statusOf('orphan')).toBe('trashed'); // orphan cleanup still runs
  });

  test('scheduled mode still runs hygiene on the same fixture', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'inflight', babyId: 'b1', origin: 'entry_draft', status: 'processing', createdAt: now - 2 * HOUR_MS });
    const staging = join(dataDir, 'media', '_staging', 'inflight');
    mkdirSync(staging, { recursive: true });

    await runReconcileOnce({ dataDir, nowMs: now, mode: 'scheduled' });

    expect(statusOf('inflight')).toBe('failed'); // stuck-pending recovery
    expect(existsSync(staging)).toBe(false); // staging GC purges the now-failed row
  });

  // "Trash N media" and "record that we trashed N" must be atomic — otherwise a
  // run-stat write failure after the soft-delete leaves media trashed with stats
  // that never reflect it, and a retry overwrites the count with 0.
  test('orphan trashing rolls back if the run-stat write fails', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    const spy = vi.spyOn(cleanupModule, 'recordCleanupRun').mockImplementation(() => {
      throw new Error('simulated stats write failure');
    });
    try {
      await expect(runReconcileOnce({ dataDir, nowMs: now })).rejects.toThrow();
      expect(statusOf('orphan')).toBe('ready'); // soft-delete rolled back, not committed
      expect(getCleanupSettings({ dataDir }).lastRunAt).toBeNull(); // no partial stat write
    } finally {
      spy.mockRestore();
    }
  });
});

describe('reconcile primitive-level hard guards', () => {
  afterEach(() => {
    setBackupInProgress(false);
    delete process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE;
  });

  function statusOf(id: string): string | undefined {
    const { db } = getDb({ dataDir });
    return db.select({ status: media.status }).from(media).where(eq(media.id, id)).get()?.status;
  }

  test('during a backup: no DB writes and no staging removals', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });
    insertMedia({ id: 'stuck', babyId: 'b1', origin: 'standalone', status: 'pending', createdAt: now - 2 * HOUR_MS });
    recordCleanupRun({ dataDir, runAtMs: 111, deletedCount: 9 });
    const staging = join(dataDir, 'media', '_staging', 'gone');
    mkdirSync(staging, { recursive: true });

    setBackupInProgress(true);
    await runReconcileOnce({ dataDir, nowMs: now, mode: 'manual' });

    expect(statusOf('orphan')).toBe('ready'); // no orphan cleanup
    expect(statusOf('stuck')).toBe('pending'); // no hygiene write
    expect(existsSync(staging)).toBe(true); // no staging removal
    const s = getCleanupSettings({ dataDir });
    expect(s.lastRunAt).toBe(111); // run-stat untouched
    expect(s.lastRunDeleted).toBe(9);
  });

  test('with the env kill-switch set: no-op even in manual mode', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });
    const staging = join(dataDir, 'media', '_staging', 'gone');
    mkdirSync(staging, { recursive: true });

    process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE = '1';
    await runReconcileOnce({ dataDir, nowMs: now, mode: 'manual' });

    expect(statusOf('orphan')).toBe('ready');
    expect(existsSync(staging)).toBe(true);
    expect(getCleanupSettings({ dataDir }).lastRunAt).toBeNull();
  });

  test('a later run behaves normally once the guards clear', async () => {
    seedBaby('b1');
    const now = Date.now();
    insertMedia({ id: 'orphan', babyId: 'b1', origin: 'entry_draft', status: 'ready', createdAt: now - 50 * HOUR_MS });

    setBackupInProgress(true);
    await runReconcileOnce({ dataDir, nowMs: now });
    expect(statusOf('orphan')).toBe('ready');

    setBackupInProgress(false);
    await runReconcileOnce({ dataDir, nowMs: now });
    expect(statusOf('orphan')).toBe('trashed');
  });
});
