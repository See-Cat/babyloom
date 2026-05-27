import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { getDb } from '@/lib/db/client';
import { babies, media } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMediaForTrash(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: media.id,
      babyId: media.babyId,
      uploadedBy: media.uploadedBy,
      status: media.status,
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
  action: 'media:trash',
  loader: loadMediaForTrash,
  getStatus: (row) => row.status,
  allowedStatuses: ['ready'],
  toResource: (row) => ({ babyId: row.babyId, mediaId: row.id, uploadedBy: row.uploadedBy })
})(async (_req, _ctx, row, userId) => {
  assertWritesAllowed();

  const { db } = getDb({ dataDir });
  db.update(media)
    .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: userId, updatedAt: Date.now() })
    .where(eq(media.id, row.id))
    .run();
  return Response.json({ trashed: row.id });
});
