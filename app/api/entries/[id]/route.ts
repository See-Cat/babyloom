import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, entries, entryMedia, entryMilestones } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadEntryWithActiveBaby(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      status: entries.status,
      deletedBy: entries.deletedBy,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

async function loadEntryForPurge(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      status: entries.status,
      deletedBy: entries.deletedBy,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row) return null;
  if (row.babyStatus !== 'active' && row.babyStatus !== 'trashed') return null;
  return row;
}

const toEntryResource = (row: Awaited<ReturnType<typeof loadEntryForPurge>>) => ({
  babyId: row!.babyId,
  entryId: row!.id,
  authorId: row!.authorId,
  deletedBy: row!.deletedBy ?? undefined
});

export const GET = withAuthorizedResource({
  action: 'entry:read',
  loader: loadEntryWithActiveBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: toEntryResource
})(async (_req, _ctx, row) => {
  return Response.json({
    id: row.id,
    babyId: row.babyId,
    authorId: row.authorId,
    content: row.content,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
});

const patchSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  occurredAt: z.number().int().optional()
});

export const PATCH = withAuthorizedResource({
  action: 'entry:write',
  loader: loadEntryWithActiveBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: toEntryResource
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
  db.update(entries)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ updated: row.id });
});

export const DELETE = withAuthorizedResource({
  action: 'entry:purge',
  loader: loadEntryForPurge,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: toEntryResource
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.delete(entryMilestones).where(eq(entryMilestones.entryId, row.id)).run();
  db.delete(entryMedia).where(eq(entryMedia.entryId, row.id)).run();
  db.update(entries)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ purged: row.id });
});
