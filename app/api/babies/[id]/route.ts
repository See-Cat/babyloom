import { and, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, entries } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

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

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['boy', 'girl', 'other']).optional(),
  avatarUrl: z.string().url().optional()
});

export const PATCH = withAuthorizedResource({
  action: 'baby:write',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({ babyId: row.id })
})(async (req, _ctx, row) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  db.update(babies)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(babies.id, row.id))
    .run();

  const updated = db.select().from(babies).where(eq(babies.id, row.id)).get();
  return Response.json({
    id: updated!.id,
    name: updated!.name,
    birthday: updated!.birthday,
    gender: updated!.gender,
    avatarUrl: updated!.avatarUrl
  });
});

export const DELETE = withAuthorizedResource({
  action: 'baby:purge',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({ babyId: row.id })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  const live = db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.babyId, row.id), eq(entries.status, 'active')))
    .all();
  if (live.length > 0) {
    return Response.json(
      { error: 'has_active_children', detail: 'trash all entries first' },
      { status: 409 }
    );
  }

  db.update(babies)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ purged: row.id });
});
