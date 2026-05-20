import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/backup/write-barrier';
import { getDb } from '@/lib/db/client';
import { babies } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { getSessionUserId } from '@/lib/permissions/session';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadBaby(id: string) {
  const { db } = getDb({ dataDir });
  return db.select().from(babies).where(eq(babies.id, id)).get() ?? null;
}

export const POST = withAuthorizedResource({
  action: 'baby:trash',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({ babyId: row.id })
})(async (req, _ctx, row) => {
  assertWritesAllowed();

  const userId = await getSessionUserId(req);
  const { db } = getDb({ dataDir });
  const now = Date.now();
  db.update(babies)
    .set({ status: 'trashed', deletedAt: now, deletedBy: userId, updatedAt: now })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ trashed: row.id });
});
