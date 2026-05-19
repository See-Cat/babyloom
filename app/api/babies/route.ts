import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  name: z.string().min(1).max(50),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['boy', 'girl', 'other'])
});

export const GET = withAuthorizedAction({ action: 'baby:read' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) return Response.json({ babies: [] });

  const rows = db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();

  return Response.json({
    babies: rows.map((baby) => ({
      id: baby.id,
      name: baby.name,
      birthday: baby.birthday,
      gender: baby.gender,
      avatarUrl: baby.avatarUrl
    }))
  });
});

export const POST = withAuthorizedAction({ action: 'baby:write' })(async (req, userId) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) return jsonBadRequest('no_family');

  const id = randomUUID();
  const now = Date.now();
  db.insert(babies)
    .values({
      id,
      familyId: member.familyId,
      name: parsed.data.name,
      birthday: parsed.data.birthday,
      gender: parsed.data.gender,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
    .run();

  return Response.json(
    {
      id,
      name: parsed.data.name,
      birthday: parsed.data.birthday,
      gender: parsed.data.gender
    },
    { status: 201 }
  );
});
