import { and, eq, inArray } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, babyMemberPermissions, familyMembers, users } from '@/lib/db/schema';
import { createMember } from '@/lib/server/members/create';
import {
  bitsToPermission,
  type MemberBabyPermissionRow
} from '@/lib/db/queries/permissions';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(200),
  nickname: z.string().min(1).max(50),
  babyAssociations: z
    .object({
      babyIds: z.array(z.string().uuid()).min(1).max(50),
      permission: z.enum(['viewer', 'editor'])
    })
    .optional()
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

  const memberIds = rows.filter((r) => r.role !== 'owner').map((r) => r.memberId);
  const perms =
    memberIds.length === 0
      ? []
      : db
          .select({
            familyMemberId: babyMemberPermissions.familyMemberId,
            babyId: babies.id,
            babyName: babies.name,
            babyAvatarUrl: babies.avatarUrl,
            babyCreatedAt: babies.createdAt,
            canRead: babyMemberPermissions.canRead,
            canWrite: babyMemberPermissions.canWrite,
            canDelete: babyMemberPermissions.canDelete
          })
          .from(babyMemberPermissions)
          .innerJoin(babies, eq(babies.id, babyMemberPermissions.babyId))
          .where(
            and(
              inArray(babyMemberPermissions.familyMemberId, memberIds),
              eq(babies.status, 'active')
            )
          )
          .orderBy(babies.createdAt)
          .all();

  const byMember = new Map<string, MemberBabyPermissionRow[]>();
  for (const p of perms) {
    const list = byMember.get(p.familyMemberId) ?? [];
    list.push({
      babyId: p.babyId,
      babyName: p.babyName,
      babyAvatarUrl: p.babyAvatarUrl,
      permission: bitsToPermission({
        canRead: p.canRead,
        canWrite: p.canWrite,
        canDelete: p.canDelete
      })
    });
    byMember.set(p.familyMemberId, list);
  }

  return Response.json({
    members: rows.map((r) => ({
      ...r,
      babyPermissions: byMember.get(r.memberId) ?? []
    }))
  });
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
      role: 'member',
      babyAssociations: parsed.data.babyAssociations
    });
    return Response.json(
      {
        memberId: result.memberId,
        userId: result.userId,
        username: parsed.data.username,
        nickname: parsed.data.nickname
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'username_taken') {
      return Response.json({ error: 'username_taken' }, { status: 409 });
    }
    if (msg === 'invalid_baby_id') {
      return jsonBadRequest('invalid_baby_id');
    }
    throw e;
  }
});
