import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { assertWritesAllowed } from '@/lib/backup/write-barrier';
import {
  babies,
  entries,
  entryMedia,
  entryMilestones,
  familyMembers,
  milestones
} from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  babyId: z.string().regex(UUID_RE),
  content: z.string().max(10000),
  occurredAt: z.number().int().optional(),
  milestoneIds: z.array(z.string().regex(UUID_RE)).optional()
});
const createResourceSchema = z.object({
  babyId: z.string().regex(UUID_RE)
});

export const GET = withAuthorizedAction({ action: 'baby:read' })(async (req, userId) => {
  const url = new URL(req.url);
  const babyId = url.searchParams.get('babyId');
  if (!babyId || !UUID_RE.test(babyId)) return jsonBadRequest('babyId required');

  let baby: any;
  try {
    baby = await loadAndAssertTarget({
      id: babyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'baby:read' },
      dataDir
    });
  } catch {
    return jsonNotFound();
  }

  const { db } = getDb({ dataDir });
  const rows = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      createdAt: entries.createdAt
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(
      and(eq(entries.babyId, baby.id), eq(entries.status, 'active'), eq(babies.status, 'active'))
    )
    .orderBy(desc(entries.occurredAt))
    .all();

  const entryIds = rows.map((row) => row.id);
  const bridges = entryIds.length
    ? db
        .select({ entryId: entryMedia.entryId, mediaId: entryMedia.mediaId })
        .from(entryMedia)
        .where(inArray(entryMedia.entryId, entryIds))
        .all()
    : [];
  const mediaIdsByEntry = new Map<string, string[]>();
  for (const bridge of bridges) {
    const list = mediaIdsByEntry.get(bridge.entryId) ?? [];
    list.push(bridge.mediaId);
    mediaIdsByEntry.set(bridge.entryId, list);
  }

  return Response.json({
    entries: rows.map((row) => ({ ...row, mediaIds: mediaIdsByEntry.get(row.id) ?? [] }))
  });
});

export const POST = withAuthorizedAction({
  action: 'entry:write',
  resolveResource: async (req, userId) => {
    let body: unknown;
    try {
      body = await req.clone().json();
    } catch {
      return { authorId: userId };
    }
    const parsed = createResourceSchema.safeParse(body);
    return parsed.success
      ? { babyId: parsed.data.babyId, authorId: userId }
      : { authorId: userId };
  }
})(async (req, userId) => {
  assertWritesAllowed();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  let baby: any;
  try {
    baby = await loadAndAssertTarget({
      id: parsed.data.babyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'baby:read' },
      dataDir
    });
  } catch {
    return jsonNotFound();
  }

  const { db } = getDb({ dataDir });
  const id = randomUUID();
  const now = Date.now();
  const occurredAt = parsed.data.occurredAt ?? now;
  let validMilestones: { id: string }[] = [];
  if (parsed.data.milestoneIds && parsed.data.milestoneIds.length > 0) {
    const callerMember = db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId))
      .get();
    if (!callerMember) return jsonNotFound();

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
    if (validMilestones.length !== parsed.data.milestoneIds.length) {
      return jsonNotFound();
    }
  }

  db.transaction((tx) => {
    tx.insert(entries)
      .values({
        id,
        babyId: baby.id,
        authorId: userId,
        content: parsed.data.content,
        occurredAt,
        status: 'active',
        createdAt: now,
        updatedAt: now
      })
      .run();
    for (const m of validMilestones) {
      tx.insert(entryMilestones).values({ entryId: id, milestoneId: m.id }).run();
    }
  });

  return Response.json({ id, babyId: baby.id, authorId: userId, occurredAt }, { status: 201 });
});
