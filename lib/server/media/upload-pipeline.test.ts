import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';
import { runUploadPipeline } from '@/lib/server/media/upload-pipeline';
import { resetMediaLimitsCacheForTesting } from '@/lib/server/media/config';

// Copy a fixture into a throwaway path because the pipeline renames the upload
// out of place. Each pipeline call needs its own fresh copy of the bytes.
function stageUpload(rel: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pl-up-'));
  const dest = join(dir, 'upload.bin');
  copyFileSync(resolve(rel), dest);
  return dest;
}

const PHOTO = 'tests/fixtures/media/2x2.jpg';

describe('upload pipeline dedupe provenance', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-pipeline-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
    resetMediaLimitsCacheForTesting();
  });

  afterEach(() => {
    resetMediaLimitsCacheForTesting();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  // A standalone (gallery) upload that dedupes onto an abandoned, still-ready
  // entry_draft must NOT inherit the draft's mortality: an explicit "keep it"
  // upload graduates the surviving row to standalone, so reconcile leaves it.
  it('promotes an inherited entry_draft dupe when the deduping upload is standalone', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    const first = await runUploadPipeline({
      dataDir,
      userId: ctx.ownerId,
      babyId: ctx.babyId,
      entryId: null,
      origin: 'entry_draft',
      clientUploadId: randomUUID(),
      filenameRaw: 'p.jpg',
      uploadedFilePath: stageUpload(PHOTO)
    });
    expect(first.kind).toBe('created');
    const mediaId = first.mediaId;

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    // Age the abandoned draft past the orphan-cleanup cutoff.
    db.update(media)
      .set({ createdAt: Date.now() - 30 * 60 * 60 * 1000 })
      .where(eq(media.id, mediaId))
      .run();

    const second = await runUploadPipeline({
      dataDir,
      userId: ctx.ownerId,
      babyId: ctx.babyId,
      entryId: null,
      origin: 'standalone',
      clientUploadId: randomUUID(),
      filenameRaw: 'p.jpg',
      uploadedFilePath: stageUpload(PHOTO)
    });
    expect(second.kind).toBe('deduped');
    expect(second.mediaId).toBe(mediaId);
    expect(db.select({ origin: media.origin }).from(media).where(eq(media.id, mediaId)).get()?.origin).toBe('standalone');

    const { runReconcileOnce } = await import('@/lib/server/media/reconcile');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get()?.status).toBe('ready');
  });

  // A composer re-upload (entry_draft, no entryId) that dedupes onto an OLD
  // still-ready draft must restart the cleanup clock — dedupe should behave like
  // a fresh upload — so the next reconcile doesn't reap the media out from under
  // the open composer.
  it('refreshes the cleanup clock when a composer upload dedupes onto an old draft', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);

    const first = await runUploadPipeline({
      dataDir,
      userId: ctx.ownerId,
      babyId: ctx.babyId,
      entryId: null,
      origin: 'entry_draft',
      clientUploadId: randomUUID(),
      filenameRaw: 'p.jpg',
      uploadedFilePath: stageUpload(PHOTO)
    });
    expect(first.kind).toBe('created');
    const mediaId = first.mediaId;

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    const staleCreatedAt = Date.now() - 30 * 60 * 60 * 1000;
    db.update(media).set({ createdAt: staleCreatedAt }).where(eq(media.id, mediaId)).run();

    const second = await runUploadPipeline({
      dataDir,
      userId: ctx.ownerId,
      babyId: ctx.babyId,
      entryId: null,
      origin: 'entry_draft', // composer re-upload
      clientUploadId: randomUUID(),
      filenameRaw: 'p.jpg',
      uploadedFilePath: stageUpload(PHOTO)
    });
    expect(second.kind).toBe('deduped');
    expect(second.mediaId).toBe(mediaId);
    // Clock restarted: createdAt is no longer the stale value.
    expect(db.select({ createdAt: media.createdAt }).from(media).where(eq(media.id, mediaId)).get()!.createdAt).toBeGreaterThan(staleCreatedAt);

    const { runReconcileOnce } = await import('@/lib/server/media/reconcile');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get()?.status).toBe('ready');
  });
});
