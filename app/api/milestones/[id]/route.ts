import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { milestones } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMilestone(id: string) {
  const { db } = getDb({ dataDir });
  return db.select().from(milestones).where(eq(milestones.id, id)).get() ?? null;
}

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().min(1).max(10).optional(),
  sortOrder: z.number().int().optional()
});

export const PATCH = withAuthorizedResource({
  action: 'milestone:manage',
  loader: loadMilestone,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: () => ({})
})(async (req, _ctx, row) => {
  if (row.familyId === null) {
    return Response.json({ error: 'cannot_modify_system_milestone' }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  db.update(milestones).set(parsed.data).where(eq(milestones.id, row.id)).run();
  return Response.json({ updated: row.id });
});

export const DELETE = withAuthorizedResource({
  action: 'milestone:manage',
  loader: loadMilestone,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: () => ({})
})(async (_req, _ctx, row) => {
  if (row.familyId === null) {
    return Response.json({ error: 'cannot_delete_system_milestone' }, { status: 409 });
  }
  const { db } = getDb({ dataDir });
  db.delete(milestones).where(eq(milestones.id, row.id)).run();
  return Response.json({ deleted: row.id });
});
