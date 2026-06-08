import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function trashReq(): any {
  return new Request('http://localhost/api/media/x/trash', { method: 'POST' });
}

function ctxFor(id: string): any {
  return { params: Promise.resolve({ id }) };
}

async function insertReadyMedia(dataDir: string, babyId: string, uploadedBy: string): Promise<string> {
  const { getDb } = await import('@/lib/server/db/client');
  const { media } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });
  const id = randomUUID();
  const now = Date.now();
  db.insert(media)
    .values({
      id,
      babyId,
      uploadedBy,
      clientUploadId: randomUUID(),
      filename: 'photo.jpg',
      status: 'ready',
      type: 'photo',
      mimeType: 'image/jpeg',
      relativePath: `2024/01/${id}`,
      originalExt: 'jpg',
      createdAt: now,
      updatedAt: now
    })
    .run();
  return id;
}

describe('POST /api/media/[id]/trash', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-media-trash-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('soft-deletes an orphan ready media (status -> trashed)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertReadyMedia(dataDir, ctx.babyId, ctx.ownerId);

    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/media/[id]/trash/route');
    const res = await POST(trashReq(), ctxFor(mediaId));
    expect(res.status).toBe(200);

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    const row = db.select().from(media).where(eq(media.id, mediaId)).get();
    expect(row?.status).toBe('trashed');
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.deletedBy).toBe(ctx.ownerId);
  });

  // Gallery delete (GalleryGrid) trashes attached media too, so this route must
  // NOT require an orphan. Our orphan-cleanup callers only pass unattached media,
  // but the route stays permissive to match gallery semantics.
  it('soft-deletes even when attached to an entry (gallery delete semantics)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertReadyMedia(dataDir, ctx.babyId, ctx.ownerId);

    const { getDb } = await import('@/lib/server/db/client');
    const { entryMedia, media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    db.insert(entryMedia)
      .values({ entryId: ctx.activeEntryId, mediaId, attachedBy: ctx.ownerId, attachedAt: Date.now() })
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/media/[id]/trash/route');
    const res = await POST(trashReq(), ctxFor(mediaId));
    expect(res.status).toBe(200);

    const row = db.select().from(media).where(eq(media.id, mediaId)).get();
    expect(row?.status).toBe('trashed');
  });

  it('returns 404 for a media that is not ready (already trashed)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const mediaId = await insertReadyMedia(dataDir, ctx.babyId, ctx.ownerId);
    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });
    db.update(media).set({ status: 'trashed', deletedAt: Date.now() }).where(eq(media.id, mediaId)).run();

    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/media/[id]/trash/route');
    const res = await POST(trashReq(), ctxFor(mediaId));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent media', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/server/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { POST } = await import('@/app/api/media/[id]/trash/route');
    const res = await POST(trashReq(), ctxFor(randomUUID()));
    expect(res.status).toBe(404);
  });
});
