'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, babyMemberPermissions, familyMembers } from '@/lib/db/schema';
import { createLogger } from '@/lib/log/server';
import { assertPermission } from '@/lib/permissions/assert';
import { ForbiddenError, UnauthorizedError } from '@/lib/permissions/errors';
import { getSessionUserIdFromHeaders } from '@/lib/permissions/session';
import { upsertPermission, resetMember } from '@/lib/db/queries/permissions';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const cellSchema = z.object({
  memberId: z.string().uuid(),
  babyId: z.string().uuid(),
  field: z.enum(['canRead', 'canWrite', 'canDelete']),
  value: z.enum(['true', 'false'])
});

export type PermissionActionResult = { ok: true } | { ok: false; error: string };

function notFound(e: unknown) {
  return e instanceof ForbiddenError || e instanceof UnauthorizedError;
}

async function requireOwner() {
  const userId = await getSessionUserIdFromHeaders(headers());
  await assertPermission(userId, 'member:manage');
  return userId;
}

function getFamilyIdForOwner(db: ReturnType<typeof getDb>['db'], userId: string) {
  return db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get()?.familyId;
}

function defaultBits(role: string) {
  return role === 'editor'
    ? { canRead: 1, canWrite: 1, canDelete: 1 }
    : { canRead: 1, canWrite: 0, canDelete: 0 };
}

export async function setPermissionCell(formData: FormData): Promise<PermissionActionResult> {
  let userId: string;
  try {
    userId = await requireOwner();
  } catch (e) {
    if (notFound(e)) return { ok: false, error: 'not_found' };
    throw e;
  }

  const parsed = cellSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  const { db } = getDb({ dataDir });
  const familyId = getFamilyIdForOwner(db, userId);
  if (!familyId) return { ok: false, error: 'not_found' };

  const member = db
    .select({ id: familyMembers.id, role: familyMembers.role })
    .from(familyMembers)
    .where(
      and(eq(familyMembers.id, parsed.data.memberId), eq(familyMembers.familyId, familyId))
    )
    .get();
  const baby = db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.id, parsed.data.babyId), eq(babies.familyId, familyId)))
    .get();
  if (!member || member.role === 'owner' || !baby) return { ok: false, error: 'not_found' };

  const current = db
    .select()
    .from(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, parsed.data.memberId),
        eq(babyMemberPermissions.babyId, parsed.data.babyId)
      )
    )
    .get();
  const next = {
    ...defaultBits(member.role),
    ...(current
      ? {
          canRead: current.canRead,
          canWrite: current.canWrite,
          canDelete: current.canDelete
        }
      : {}),
    [parsed.data.field]: parsed.data.value === 'true' ? 1 : 0
  };

  upsertPermission({
    db,
    familyMemberId: parsed.data.memberId,
    babyId: parsed.data.babyId,
    override: next
  });

  createLogger({ dataDir, level: 'info' }).info(
    {
      module: 'permission-config',
      actorUserId: userId,
      familyMemberId: parsed.data.memberId,
      babyId: parsed.data.babyId,
      field: parsed.data.field,
      value: parsed.data.value === 'true'
    },
    'permission cell updated'
  );
  revalidatePath('/profile/members/permissions');
  return { ok: true };
}

export async function resetMemberRow(memberId: string): Promise<PermissionActionResult> {
  let userId: string;
  try {
    userId = await requireOwner();
  } catch (e) {
    if (notFound(e)) return { ok: false, error: 'not_found' };
    throw e;
  }

  const parsed = z.string().uuid().safeParse(memberId);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  const { db } = getDb({ dataDir });
  const familyId = getFamilyIdForOwner(db, userId);
  if (!familyId) return { ok: false, error: 'not_found' };
  const member = db
    .select({ id: familyMembers.id, role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.id, parsed.data), eq(familyMembers.familyId, familyId)))
    .get();
  if (!member || member.role === 'owner') return { ok: false, error: 'not_found' };

  resetMember({ db, familyMemberId: parsed.data });
  createLogger({ dataDir, level: 'info' }).info(
    { module: 'permission-config', actorUserId: userId, familyMemberId: parsed.data },
    'permission member reset'
  );
  revalidatePath('/profile/members/permissions');
  return { ok: true };
}
