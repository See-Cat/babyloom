import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { babies, media } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMediaForStatus(id: string) {
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

export const GET = withAuthorizedResource({
  action: 'media:read',
  loader: loadMediaForStatus,
  getStatus: (row) => row.status,
  allowedStatuses: ['pending', 'processing', 'ready', 'failed', 'trashed'],
  toResource: (row) => ({ babyId: row.babyId, mediaId: row.id, uploadedBy: row.uploadedBy })
})(async (_req, _ctx, row) => {
  return Response.json({ status: row.status, mediaId: row.id });
});
