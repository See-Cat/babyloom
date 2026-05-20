import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { assertWritesAllowed } from '@/lib/backup/write-barrier';
import { getDb } from '@/lib/db/client';
import {
  babies,
  entries,
  entryMedia,
  entryMilestones,
  familyMembers,
  milestones
} from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';
import { purgeEntry } from '@/lib/trash/purge';

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
  const { db } = getDb({ dataDir });
  const attached = db
    .select({ id: milestones.id, name: milestones.name, icon: milestones.icon })
    .from(entryMilestones)
    .innerJoin(milestones, eq(milestones.id, entryMilestones.milestoneId))
    .where(eq(entryMilestones.entryId, row.id))
    .all();
  const attachedMedia = db
    .select({ mediaId: entryMedia.mediaId })
    .from(entryMedia)
    .where(eq(entryMedia.entryId, row.id))
    .all();

  return Response.json({
    id: row.id,
    babyId: row.babyId,
    authorId: row.authorId,
    content: row.content,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    milestones: attached,
    mediaIds: attachedMedia.map((item) => item.mediaId)
  });
});

const patchSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  occurredAt: z.number().int().optional(),
  milestoneIds: z.array(z.string().regex(UUID_RE)).optional()
});

export const PATCH = withAuthorizedResource({
  action: 'entry:write',
  loader: loadEntryWithActiveBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: toEntryResource
})(async (req, _ctx, row, userId) => {
  assertWritesAllowed();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  let validMilestones: { id: string }[] = [];
  if (parsed.data.milestoneIds !== undefined) {
    const callerMember = db
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId))
      .get();
    if (!callerMember) return jsonNotFound();

    if (parsed.data.milestoneIds.length > 0) {
      validMilestones = db
        .select({ id: milestones.id })
        .from(milestones)
        .where(
          and(
            inArray(milestones.id, parsed.data.milestoneIds),
            or(isNull(milestones.familyId), eq(milestones.familyId, callerMember.familyId))
          )
        )
        .all();
      if (validMilestones.length !== parsed.data.milestoneIds.length) return jsonNotFound();
    }
  }

  db.transaction((tx) => {
    const setFields: Record<string, unknown> = { updatedAt: Date.now() };
    if (parsed.data.content !== undefined) setFields.content = parsed.data.content;
    if (parsed.data.occurredAt !== undefined) setFields.occurredAt = parsed.data.occurredAt;
    tx.update(entries).set(setFields).where(eq(entries.id, row.id)).run();

    if (parsed.data.milestoneIds !== undefined) {
      tx.delete(entryMilestones).where(eq(entryMilestones.entryId, row.id)).run();
      for (const m of validMilestones) {
        tx.insert(entryMilestones).values({ entryId: row.id, milestoneId: m.id }).run();
      }
    }
  });
  return Response.json({ updated: row.id });
});

export const DELETE = withAuthorizedResource({
  action: 'entry:purge',
  loader: loadEntryForPurge,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: toEntryResource
})(async (_req, _ctx, row) => {
  assertWritesAllowed();

  purgeEntry(dataDir, row.id);
  return Response.json({ purged: row.id });
});
