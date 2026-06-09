import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function restoreReq(): any {
  return new Request('http://localhost/api/media/x/restore', { method: 'POST' });
}

function ctxFor(id: string): any {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/media/[id]/restore', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-media-restore-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  // Restoring a system-trashed orphan draft from the trash bin is an explicit
  // "keep it" signal. It must be durable: the next reconcile run must not match
  // and re-trash it. So restore graduates the row to origin 'standalone'.
  it('durably restores a system-trashed entry_draft orphan (reconcile keeps it ready)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });

    const id = randomUUID();
    const old = Date.now() - 30 * 60 * 60 * 1000;
    db.insert(media)
      .values({
        id,
        babyId: ctx.babyId,
        uploadedBy: ctx.ownerId,
        clientUploadId: randomUUID(),
        origin: 'entry_draft',
        status: 'trashed',
        filename: 'p.jpg',
        deletedAt: old,
        deletedBy: null, // system-trashed by reconcile
        createdAt: old,
        updatedAt: old
      })
      .run();

    vi.doMock('@/lib/server/permissions/session', () => ({ getSessionUserId: async () => ctx.ownerId }));
    const { POST } = await import('@/app/api/media/[id]/restore/route');
    const res = await POST(restoreReq(), ctxFor(id));
    expect(res.status).toBe(200);

    expect(db.select({ origin: media.origin }).from(media).where(eq(media.id, id)).get()?.origin).toBe('standalone');

    const { runReconcileOnce } = await import('@/lib/server/media/reconcile');
    await runReconcileOnce({ dataDir, nowMs: Date.now() });
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, id)).get()?.status).toBe('ready');
  });

  // Restoring would set status='ready', but a ready row with the same content
  // already exists → the partial unique index (babyId, contentHash WHERE
  // status='ready') would throw. Return a controlled 409 (which the trash UI
  // surfaces as a friendly message) instead of a 500.
  it('returns 409 instead of 500 when the content already exists as a ready row', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { db } = getDb({ dataDir });

    const hash = 'dupcontenthash';
    const old = Date.now() - 30 * 60 * 60 * 1000;
    const m1 = randomUUID(); // system-trashed draft being restored
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
    const m2 = randomUUID(); // same bytes already live in the gallery
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
    const { POST } = await import('@/app/api/media/[id]/restore/route');
    const res = await POST(restoreReq(), ctxFor(m1));
    expect(res.status).toBe(409);

    // Nothing changed: the trashed draft stays trashed, the ready dup stays ready.
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, m1)).get()?.status).toBe('trashed');
    expect(db.select({ status: media.status }).from(media).where(eq(media.id, m2)).get()?.status).toBe('ready');
  });
});
