import { eq, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/server/db/client';
import { familyMembers, milestones } from '@/lib/server/db/schema';
import { withAuthorizedAction } from '@/lib/server/permissions/action-template';
import { jsonBadRequest } from '@/lib/server/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
  sortOrder: z.number().int().optional()
});

export const GET = withAuthorizedAction({ action: 'baby:read' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const member = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!member) return Response.json({ milestones: [] });

  const rows = db
    .select()
    .from(milestones)
    .where(or(isNull(milestones.familyId), eq(milestones.familyId, member.familyId)))
    .all();

  return Response.json({
    milestones: rows.map((m) => ({
      id: m.id,
      name: m.name,
      icon: m.icon,
      sortOrder: m.sortOrder,
      isSystem: m.familyId === null
    }))
  });
});

export const POST = withAuthorizedAction({ action: 'milestone:manage' })(async (req, userId) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const member = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!member) return jsonBadRequest('no_family');

  const id = randomUUID();
  db.insert(milestones)
    .values({
      id,
      familyId: member.familyId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdAt: Date.now()
    })
    .run();
  return Response.json({ id, name: parsed.data.name, icon: parsed.data.icon }, { status: 201 });
});
