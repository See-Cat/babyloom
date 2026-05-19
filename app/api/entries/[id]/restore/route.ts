import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies, entries } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

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
  action: 'entry:restore',
  loader: loadEntry,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({
    babyId: row.babyId,
    entryId: row.id,
    authorId: row.authorId,
    deletedBy: row.deletedBy ?? undefined
  })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.update(entries)
    .set({ status: 'active', deletedAt: null, deletedBy: null, updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
