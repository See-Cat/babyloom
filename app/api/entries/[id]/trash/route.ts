import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { getDb } from '@/lib/server/db/client';
import { babies, entries } from '@/lib/server/db/schema';
import { withAuthorizedResource } from '@/lib/server/permissions/route-template';
import { getSessionUserId } from '@/lib/server/permissions/session';
import { cascadeTrashEntryMedia } from '@/lib/server/trash/entry-media-cascade';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadEntry(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      status: entries.status,
      deletedBy: entries.deletedBy,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

export const POST = withAuthorizedResource({
  action: 'entry:trash',
  loader: loadEntry,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({
    babyId: row.babyId,
    entryId: row.id,
    authorId: row.authorId
  })
})(async (req, _ctx, row) => {
  assertWritesAllowed();

  const userId = await getSessionUserId(req);
  const { db } = getDb({ dataDir });
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(entries)
      .set({ status: 'trashed', deletedAt: now, deletedBy: userId, updatedAt: now })
      .where(eq(entries.id, row.id))
      .run();
    // Photos attached only to this entry follow it into the trash so they
    // leave the gallery; restoring the entry brings them back.
    cascadeTrashEntryMedia(tx, row.id, userId, now);
  });
  return Response.json({ trashed: row.id });
});
