import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function attachReq(): any {
  return new Request('http://localhost/api/entries/x/media/y/attach', { method: 'POST' });
}

function ctxFor(id: string, mediaId: string): any {
  return { params: Promise.resolve({ id, mediaId }) };
}

async function insertDraftMedia(dataDir: string, babyId: string, uploadedBy: string, createdAt: number): Promise<string> {
  const { getDb } = await import('@/lib/server/db/client');
  const { media } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });
  const id = randomUUID();
  db.insert(media)
    .values({
      id,
      babyId,
      uploadedBy,
      clientUploadId: randomUUID(),
      origin: 'entry_draft',
      filename: 'photo.jpg',
      status: 'ready',
      type: 'photo',
      relativePath: `2024/01/${id}`,
      originalExt: 'jpg',
      createdAt,
      updatedAt: createdAt
    })
    .run();
  return id;
}

describe('attach route promotes entry-draft media so reconcile cannot reclaim it', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-attach-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    vi.doUnmock('@/lib/server/permissions/target-loaders');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('promotes origin entry_draft -> standalone on successful attach', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertDraftMedia(dataDir, ctx.babyId, ctx.ownerId, Date.now());

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    const res = await POST(attachReq(), ctxFor(ctx.activeEntryId, mediaId));
    expect(res.status).toBe(200);

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    const row = db.select({ origin: media.origin }).from(media).where(eq(media.id, mediaId)).get();
    expect(row?.origin).toBe('standalone');
  });

  // A still-live composer draft whose upload aged past the cleanup cutoff gets
  // trashed by reconcile before the user submits. The real attach is an explicit
  // "keep it" signal: it must restore + graduate the media, not 404.
  it('rescues a system-trashed entry_draft media when the user finally attaches it', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const oldCreatedAt = Date.now() - 30 * 60 * 60 * 1000;
    const mediaId = await insertDraftMedia(dataDir, ctx.babyId, ctx.ownerId, oldCreatedAt);

    const { runReconcileOnce } = await import('@/lib/server/media/reconcile');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });

    const { getDb } = await import('@/lib/server/db/client');
    const { entryMedia, media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get()?.status).toBe('trashed');

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    const res = await POST(attachReq(), ctxFor(ctx.activeEntryId, mediaId));
    expect(res.status).toBe(200);

    const row = db.select().from(media).where(eq(media.id, mediaId)).get();
    expect(row?.status).toBe('ready');
    expect(row?.origin).toBe('standalone');
    expect(row?.deletedAt).toBeNull();
    const link = db
      .select()
      .from(entryMedia)
      .where(and(eq(entryMedia.entryId, ctx.activeEntryId), eq(entryMedia.mediaId, mediaId)))
      .get();
    expect(link).toBeTruthy();
  });

  it('does not resurrect a user-trashed media on attach (still 404)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertDraftMedia(dataDir, ctx.babyId, ctx.ownerId, Date.now());

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    // User-trashed: deletedBy is set (unlike the system backstop which leaves it null).
    db.update(media)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: ctx.ownerId })
      .where(eq(media.id, mediaId))
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    const res = await POST(attachReq(), ctxFor(ctx.activeEntryId, mediaId));
    expect(res.status).toBe(404);
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get()?.status).toBe('trashed');
  });

  // TOCTOU: the handler loaded the media as `ready`, but reconcile trashed it in
  // the window before the write. The decision must come from CURRENT db state, so
  // attach restores it instead of returning success while leaving it trashed.
  it('restores a media that got system-trashed between load and the attach write', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertDraftMedia(dataDir, ctx.babyId, ctx.ownerId, Date.now() - 30 * 60 * 60 * 1000);

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    // Simulate reconcile having trashed it (system trash: deletedBy null).
    db.update(media)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: null })
      .where(eq(media.id, mediaId))
      .run();

    // ...but the request handler loaded a STALE `ready` snapshot just before.
    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    vi.doMock('@/lib/server/permissions/target-loaders', () => ({
      loadAndAssertTarget: async (opts: { table: string; id: string }) =>
        opts.table === 'media'
          ? { id: opts.id, babyId: ctx.babyId, uploadedBy: ctx.ownerId, status: 'ready', origin: 'entry_draft', deletedBy: null }
          : { id: opts.id, babyId: ctx.babyId, authorId: ctx.ownerId, status: 'active' }
    }));
    const { POST } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    const res = await POST(attachReq(), ctxFor(ctx.activeEntryId, mediaId));
    expect(res.status).toBe(200);

    const row = db.select().from(media).where(eq(media.id, mediaId)).get();
    expect(row?.status).toBe('ready');
    expect(row?.origin).toBe('standalone');
    expect(row?.deletedAt).toBeNull();
  });

  // Rescue must not collide with the partial unique index (babyId, contentHash
  // WHERE status='ready'): if the same bytes were re-uploaded as a ready row
  // while the draft sat trashed, restoring the draft to ready would throw. Attach
  // the existing ready dup instead and leave the trashed draft alone.
  it('attaches an existing ready dup instead of 500ing when rescue would violate the unique index', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/server/db/client');
    const { entryMedia, media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });

    const hash = 'samecontenthash';
    const old = Date.now() - 30 * 60 * 60 * 1000;
    const m1 = randomUUID(); // abandoned draft the backstop trashed
    db.insert(media)
      .values({
        id: m1,
        babyId: ctx.babyId,
        uploadedBy: ctx.ownerId,
        clientUploadId: randomUUID(),
        origin: 'entry_draft',
        status: 'trashed',
        filename: 'p.jpg',
        contentHash: hash,
        deletedAt: old,
        deletedBy: null,
        createdAt: old,
        updatedAt: old
      })
      .run();
    const m2 = randomUUID(); // same bytes re-uploaded to the gallery, now the ready row
    db.insert(media)
      .values({
        id: m2,
        babyId: ctx.babyId,
        uploadedBy: ctx.ownerId,
        clientUploadId: randomUUID(),
        origin: 'standalone',
        status: 'ready',
        filename: 'p.jpg',
        contentHash: hash,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    const res = await POST(attachReq(), ctxFor(ctx.activeEntryId, m1));
    expect(res.status).toBe(200);

    // Entry is linked to the ready dup, not the trashed draft.
    expect(
      db.select().from(entryMedia).where(and(eq(entryMedia.entryId, ctx.activeEntryId), eq(entryMedia.mediaId, m2))).get()
    ).toBeTruthy();
    expect(
      db.select().from(entryMedia).where(and(eq(entryMedia.entryId, ctx.activeEntryId), eq(entryMedia.mediaId, m1))).get()
    ).toBeFalsy();
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, m2)).get()?.status).toBe('ready');
    // The trashed draft is left as-is (not resurrected into a second ready row).
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, m1)).get()?.status).toBe('trashed');
  });

  // The data-loss scenario Codex flagged: a composer photo that was saved to an
  // entry, then later detached (kept in the gallery by design), must NOT be
  // reclaimed by the orphan-cleanup backstop even when it is old and unattached.
  it('keeps a once-attached, later-detached media through reconcile after 25h', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const oldCreatedAt = Date.now() - 30 * 60 * 60 * 1000;
    const mediaId = await insertDraftMedia(dataDir, ctx.babyId, ctx.ownerId, oldCreatedAt);

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST, DELETE } = await import('@/app/api/entries/[id]/media/[mediaId]/attach/route');
    expect((await POST(attachReq(), ctxFor(ctx.activeEntryId, mediaId))).status).toBe(200);
    expect((await DELETE(attachReq(), ctxFor(ctx.activeEntryId, mediaId))).status).toBe(200);

    const { runReconcileOnce } = await import('@/lib/server/media/reconcile');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    const row = db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get();
    expect(row?.status).toBe('ready');
  });
});
