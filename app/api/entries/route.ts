import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, entries } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  babyId: z.string().regex(UUID_RE),
  content: z.string().min(1).max(10000),
  occurredAt: z.number().int().optional()
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

  return Response.json({ entries: rows });
});

export const POST = withAuthorizedAction({
  action: 'entry:write',
  resolveResource: async (_req, userId) => ({ authorId: userId })
})(async (req, userId) => {
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
  db.insert(entries)
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

  return Response.json({ id, babyId: baby.id, authorId: userId, occurredAt }, { status: 201 });
});
