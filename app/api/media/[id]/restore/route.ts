import { eq } from 'drizzle-orm';
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
  db.update(media)
    .set({ status: 'ready', deletedAt: null, deletedBy: null, updatedAt: Date.now() })
    .where(eq(media.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
