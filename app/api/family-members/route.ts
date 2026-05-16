import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';
import { createMember } from '@/lib/members/create';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(200),
  nickname: z.string().min(1).max(50),
  role: z.enum(['editor', 'viewer'])
});

export const GET = withAuthorizedAction({ action: 'member:manage' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const caller = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!caller) return Response.json({ members: [] });

  const rows = db
    .select({
      memberId: familyMembers.id,
      userId: users.id,
      username: users.username,
      nickname: users.name,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, caller.familyId))
    .all();

  return Response.json({ members: rows });
});

export const POST = withAuthorizedAction({ action: 'member:manage' })(async (req, userId) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const caller = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!caller) return jsonBadRequest('no_family');

  try {
    const result = await createMember({
      dataDir,
      familyId: caller.familyId,
      username: parsed.data.username,
      password: parsed.data.password,
      nickname: parsed.data.nickname,
      role: parsed.data.role
    });
    return Response.json(
      {
        memberId: result.memberId,
        userId: result.userId,
        username: parsed.data.username,
        nickname: parsed.data.nickname,
        role: parsed.data.role
      },
      { status: 201 }
    );
  } catch (e) {
    if ((e as Error).message === 'username_taken') {
      return Response.json({ error: 'username_taken' }, { status: 409 });
    }
    throw e;
  }
});
