import { and, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, babyMemberPermissions, familyMembers } from '@/lib/db/schema';
import {
  batchUpsertMemberPermissions,
  clearPermissionRow
} from '@/lib/db/queries/permissions';
import { withAuthorizedActionRoute } from '@/lib/permissions/route-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const patchSchema = z.object({
  permission: z.enum(['viewer', 'editor'])
});

// Extract :memberId and :babyId from URL — wrapper drops multi-param ctx.
// Path shape: /api/family-members/:memberId/baby-permissions/:babyId
function parsePathIds(req: Request): { memberId: string; babyId: string } | null {
  const parts = new URL(req.url).pathname.split('/');
  const babyId = parts.at(-1) ?? '';
  const memberId = parts.at(-3) ?? '';
  if (!UUID_RE.test(memberId) || !UUID_RE.test(babyId)) return null;
  return { memberId, babyId };
}

// Verify target member belongs to caller's family and isn't the owner;
// verify babyId belongs to caller's family. All mismatches collapse to 400.
function loadAndValidate(opts: {
  familyId: string;
  memberId: string;
  babyId: string;
}) {
  const { db } = getDb({ dataDir });
  const target = db
    .select({ id: familyMembers.id, role: familyMembers.role, familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.id, opts.memberId))
    .get();
  if (!target || target.familyId !== opts.familyId) return { error: 'invalid' as const };
  if (target.role === 'owner') return { error: 'invalid' as const };

  const baby = db
    .select({ id: babies.id, familyId: babies.familyId })
    .from(babies)
    .where(eq(babies.id, opts.babyId))
    .get();
  if (!baby || baby.familyId !== opts.familyId) return { error: 'invalid' as const };

  return { db };
}

export const PATCH = withAuthorizedActionRoute({ action: 'member:manage' })(
  async (req, { familyId }) => {
    const ids = parsePathIds(req);
    if (!ids) return jsonNotFound();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonBadRequest('invalid_request');
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonBadRequest('invalid_request');

    const v = loadAndValidate({ familyId, memberId: ids.memberId, babyId: ids.babyId });
    if ('error' in v) return jsonBadRequest('invalid_request');

    // PATCH requires an existing row — semantics differ from POST upsert.
    const existing = v.db
      .select({ id: babyMemberPermissions.id })
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.familyMemberId, ids.memberId),
          eq(babyMemberPermissions.babyId, ids.babyId)
        )
      )
      .get();
    if (!existing) return Response.json({ error: 'not_found' }, { status: 404 });

    batchUpsertMemberPermissions({
      db: v.db,
      familyMemberId: ids.memberId,
      babyIds: [ids.babyId],
      permission: parsed.data.permission
    });

    return Response.json({ ok: true });
  }
);

export const DELETE = withAuthorizedActionRoute({ action: 'member:manage' })(
  async (req, { familyId }) => {
    const ids = parsePathIds(req);
    if (!ids) return jsonNotFound();

    const v = loadAndValidate({ familyId, memberId: ids.memberId, babyId: ids.babyId });
    if ('error' in v) return jsonBadRequest('invalid_request');

    clearPermissionRow({ db: v.db, familyMemberId: ids.memberId, babyId: ids.babyId });
    return Response.json({ ok: true });
  }
);
