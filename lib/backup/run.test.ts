import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

describe('backup', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-backup-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    const { setBackupInProgress } = await import('@/lib/backup/write-barrier');
    setBackupInProgress(false);
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('sanitizes the snapshot and builds a matching manifest', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/db/client');
    const { media, sessions } = await import('@/lib/db/schema');
    const { runBackup } = await import('@/lib/backup/run');
    const { db } = getDb({ dataDir });
    const now = Date.now();
    const readyId = randomUUID();
    const trashedId = randomUUID();
    const readyRel = `media/${ctx.babyId}/2026/05/${readyId}`;
    const trashedRel = `media/${ctx.babyId}/2026/05/${trashedId}`;
    mkdirSync(join(dataDir, readyRel), { recursive: true });
    mkdirSync(join(dataDir, trashedRel), { recursive: true });
    writeFileSync(join(dataDir, readyRel, 'original.jpg'), 'ready');
    writeFileSync(join(dataDir, trashedRel, 'original.jpg'), 'trashed');

    db.insert(media)
      .values([
        {
          id: readyId,
          babyId: ctx.babyId,
          uploadedBy: ctx.ownerId,
          clientUploadId: 'client-ready',
          type: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
          contentHash: 'ready-hash',
          relativePath: readyRel,
          originalExt: 'jpg',
          filename: 'ready.jpg',
          status: 'ready',
          createdAt: now,
          updatedAt: now
        },
        {
          id: trashedId,
          babyId: ctx.babyId,
          uploadedBy: ctx.ownerId,
          clientUploadId: 'client-trashed',
          type: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 7,
          contentHash: 'trashed-hash',
          relativePath: trashedRel,
          originalExt: 'jpg',
          filename: 'trashed.jpg',
          status: 'trashed',
          createdAt: now,
          updatedAt: now,
          deletedAt: now,
          deletedBy: ctx.ownerId
        }
      ])
      .run();
    db.insert(sessions)
      .values({
        id: randomUUID(),
        userId: ctx.ownerId,
        token: 'secret-token',
        expiresAt: new Date(now + 1000),
        createdAt: new Date(now),
        updatedAt: new Date(now)
      })
      .run();

    const backup = await runBackup({ dataDir });
    const snapshot = new Database(join(dirname(backup.zipPath), 'snapshot.db'), { readonly: true });
    try {
      expect(snapshot.prepare("SELECT count(*) AS n FROM entries WHERE status != 'active'").get()).toEqual({
        n: 0
      });
      expect(snapshot.prepare("SELECT count(*) AS n FROM media WHERE status != 'ready'").get()).toEqual({
        n: 0
      });
      expect(snapshot.prepare("SELECT count(*) AS n FROM babies WHERE status != 'active'").get()).toEqual({
        n: 0
      });
      expect(snapshot.prepare('SELECT count(*) AS n FROM session').get()).toEqual({ n: 0 });
      expect(
        snapshot
          .prepare(
            `SELECT count(*) AS n FROM media
             WHERE deleted_at IS NOT NULL OR deleted_by IS NOT NULL`
          )
          .get()
      ).toEqual({ n: 0 });
      expect(backup.manifest.files.map((file) => file.id)).toEqual([readyId]);
      expect(backup.manifest.files[0].relativePath).toBe(`${readyRel}/original.jpg`);
      expect(readFileSync(backup.zipPath).subarray(0, 4).toString('hex')).toBe('504b0304');
    } finally {
      snapshot.close();
      await backup.cleanup();
    }
  });

  it('blocks writes while the flag is set', async () => {
    const { assertWritesAllowed, setBackupInProgress } = await import('@/lib/backup/write-barrier');
    setBackupInProgress(true);
    expect(() => assertWritesAllowed()).toThrow('backup_in_progress');
    setBackupInProgress(false);
    expect(() => assertWritesAllowed()).not.toThrow();
  });

  it('returns 503 and Retry-After from a guarded route', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { setBackupInProgress } = await import('@/lib/backup/write-barrier');
    const { POST } = await import('@/app/api/entries/route');

    setBackupInProgress(true);
    const res = await POST(
      new Request('http://localhost/api/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ babyId: ctx.babyId, content: 'blocked' })
      }) as any
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('15');
  });
});
