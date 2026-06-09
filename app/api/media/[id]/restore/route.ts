import { and, eq, ne } from 'drizzle-orm';
import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { getDb } from '@/lib/server/db/client';
import { babies, media } from '@/lib/server/db/schema';
import { withAuthorizedResource } from '@/lib/server/permissions/route-template';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMediaForRestore(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: media.id,
      babyId: media.babyId,
      uploadedBy: media.uploadedBy,
      status: media.status,
      contentHash: media.contentHash,
      deletedBy: media.deletedBy,
      babyStatus: babies.status
    })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .where(eq(media.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

export const POST = withAuthorizedResource({
  action: 'media:restore',
  loader: loadMediaForRestore,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({
    babyId: row.babyId,
    mediaId: row.id,
    uploadedBy: row.uploadedBy,
    deletedBy: row.deletedBy ?? undefined
  })
})(async (_req, _ctx, row) => {
  assertWritesAllowed();

  const { db } = getDb({ dataDir });

  // Restoring sets status='ready', but the same content may already live in the
  // gallery as a ready row (e.g. the user re-uploaded the file after the backstop
  // trashed this draft). That would violate the partial unique index
  // (babyId, contentHash WHERE status='ready') and throw a raw 500. Detect it and
  // return a controlled 409 instead — the trash UI surfaces a friendly message.
  if (row.contentHash != null) {
    const readyDup =
      // PARENT-CHAIN-EXEMPT: dedupe lookup scoped to the already-authorized media's babyId.
      db
      .select({ id: media.id })
      .from(media)
      .where(
        and(
          eq(media.babyId, row.babyId),
          eq(media.contentHash, row.contentHash),
          eq(media.status, 'ready'),
          ne(media.id, row.id)
        )
      )
      .get();
    if (readyDup) return Response.json({ error: 'duplicate_ready' }, { status: 409 });
  }

  // Manual restore is an explicit "keep it" signal, so graduate the row to
  // 'standalone'. Otherwise a restored entry_draft orphan would still match the
  // reconcile backstop (ready + entry_draft + unattached + old createdAt) and get
  // re-trashed on the next run, making restore non-durable.
  db.update(media)
    .set({ status: 'ready', origin: 'standalone', deletedAt: null, deletedBy: null, updatedAt: Date.now() })
    .where(eq(media.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
