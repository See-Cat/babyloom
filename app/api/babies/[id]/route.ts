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

export const GET = withAuthorizedResource({
  action: 'baby:read',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({ babyId: row.id })
})(async (_req, _ctx, row) => {
  return Response.json({
    id: row.id,
    name: row.name,
    birthday: row.birthday,
    gender: row.gender,
    avatarUrl: row.avatarUrl
  });
});
