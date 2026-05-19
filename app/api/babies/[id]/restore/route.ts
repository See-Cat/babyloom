import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadBaby(id: string) {
  const { db } = getDb({ dataDir });
  return db.select().from(babies).where(eq(babies.id, id)).get() ?? null;
}

export const POST = withAuthorizedResource({
  action: 'baby:restore',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({
    babyId: row.id,
    deletedBy: row.deletedBy ?? undefined
  })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.update(babies)
    .set({
      status: 'active',
      deletedAt: null,
      deletedBy: null,
      updatedAt: Date.now()
    })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
