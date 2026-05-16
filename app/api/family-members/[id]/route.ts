import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';
import { resetMemberPassword } from '@/lib/members/create';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMember(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      userId: users.id,
      username: users.username,
      nickname: users.name,
      memberId: familyMembers.id,
      familyId: familyMembers.familyId,
      role: familyMembers.role
    })
    .from(users)
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .where(eq(users.id, id))
    .get();
  return row ?? null;
}

const patchSchema = z
  .object({
    role: z.enum(['editor', 'viewer']).optional(),
    password: z.string().min(8).max(200).optional()
  })
  .refine((v) => v.role !== undefined || v.password !== undefined, {
    message: 'at_least_one_field_required'
  });

export const PATCH = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_modify_owner_via_api' }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  if (parsed.data.role) {
    db.update(familyMembers)
      .set({ role: parsed.data.role })
      .where(eq(familyMembers.id, row.memberId))
      .run();
    db.update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .run();
  }
  if (parsed.data.password) {
    resetMemberPassword({ dataDir, userId: row.userId, newPassword: parsed.data.password });
  }
  return Response.json({ updated: row.userId });
});

export const DELETE = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (_req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_delete_owner' }, { status: 409 });
  }
  const { db } = getDb({ dataDir });
  const { sessions } = await import('@/lib/db/schema');
  db.transaction((tx) => {
    tx.delete(sessions).where(eq(sessions.userId, row.userId)).run();
    tx.delete(familyMembers).where(eq(familyMembers.id, row.memberId)).run();
  });
  return Response.json({ removed: row.userId });
});
