import { and, eq, inArray } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { batchUpsertMemberPermissions } from '@/lib/db/queries/permissions';
import { withAuthorizedActionRoute } from '@/lib/permissions/route-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const postSchema = z.object({
  babyIds: z.array(z.string().uuid()).min(1).max(50),
  permission: z.enum(['viewer', 'editor'])
});

// POST /api/family-members/:memberId/baby-permissions
// Batch upsert per-(member, baby) permission rows. Owner-only via 'member:manage'.
export const POST = withAuthorizedActionRoute({ action: 'member:manage' })(
  async (req, { familyId }) => {
    // Extract :memberId from the URL — wrapper does not surface multi-param ctx.
    // Path shape: /api/family-members/:memberId/baby-permissions
    const parts = new URL(req.url).pathname.split('/');
    const memberId = parts.at(-2) ?? '';
    if (!UUID_RE.test(memberId)) return jsonNotFound();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonBadRequest('invalid_request');
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return jsonBadRequest('invalid_request');

    const { db } = getDb({ dataDir });

    const target = db
      .select({ id: familyMembers.id, role: familyMembers.role, familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId))
      .get();
    if (!target || target.familyId !== familyId) return jsonBadRequest('invalid_request');
    if (target.role === 'owner') return jsonBadRequest('invalid_request');

    // All babyIds must belong to caller's family AND be active.
    const valid = db
      .select({ id: babies.id })
      .from(babies)
      .where(
        and(
          eq(babies.familyId, familyId),
          eq(babies.status, 'active'),
          inArray(babies.id, parsed.data.babyIds)
        )
      )
      .all();
    if (valid.length !== parsed.data.babyIds.length) return jsonBadRequest('invalid_request');

    batchUpsertMemberPermissions({
      db,
      familyMemberId: memberId,
      babyIds: parsed.data.babyIds,
      permission: parsed.data.permission
    });

    return Response.json({ ok: true }, { status: 201 });
  }
);
