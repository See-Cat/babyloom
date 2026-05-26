import { and, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { familyMembers, babyMemberPermissions, babies } from '@/lib/db/schema';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError } from './errors';

export interface AssertPermissionOptions {
  dataDir?: string;
}

// Owner-only actions (spec §5.2 "管理宝宝/成员/里程碑/家庭" + §5.4 right column).
// These IGNORE baby_member_permissions entirely — they go straight to the role matrix.
// This is the §5.3 invariant: override is a scope gate, not an authorization grant.
export const OWNER_ONLY_ACTIONS = new Set<Action>([
  'baby:write',
  'baby:trash',
  'baby:restore',
  'baby:purge',
  'entry:purge',
  'media:purge',
  'trash:empty',
  'member:manage',
  'family:manage',
  'milestone:manage',
  'system:logs',
  'system:backup'
]);

// Map an Action to the (canRead | canWrite | canDelete) bit it needs against baby_member_permissions.
// Returns null when the action is owner-only OR not baby-scoped — override cannot apply.
export function babyPermBit(action: Action): 'canRead' | 'canWrite' | 'canDelete' | null {
  if (OWNER_ONLY_ACTIONS.has(action)) return null;
  switch (action) {
    case 'baby:read':
    case 'entry:read':
    case 'media:read':
      return 'canRead';
    case 'baby:write':
    case 'entry:write':
    case 'media:write':
      return 'canWrite';
    case 'entry:trash':
    case 'entry:restore':
    case 'media:trash':
    case 'media:restore':
      return 'canDelete';
    default:
      return null; // trash:view and other non-baby-scoped actions
  }
}

export interface PermissionOverride {
  canRead: number;
  canWrite: number;
  canDelete: number;
}

export interface EvaluateOptions {
  role: 'owner' | 'member';
  override?: PermissionOverride | null;
  action: Action;
  ownership?: PermissionResource;
  userId: string;
}

export interface EvaluateResult {
  allow: boolean;
  reason: string;
}

export function evaluate(opts: EvaluateOptions): EvaluateResult {
  if (OWNER_ONLY_ACTIONS.has(opts.action) && opts.role !== 'owner') {
    return { allow: false, reason: 'owner_only' };
  }

  const bit = babyPermBit(opts.action);
  if (bit && opts.ownership?.babyId && opts.role !== 'owner') {
    // strict: non-owner must have an override row for any baby-scoped action
    if (!opts.override) return { allow: false, reason: 'no_baby_permission_row' };
    if (opts.override[bit] !== 1) return { allow: false, reason: `baby_perm_${bit}_denied` };
  }

  try {
    checkOwnershipMatrix(opts.action, opts.role, opts.userId, opts.ownership);
    return { allow: true, reason: 'allowed' };
  } catch (e) {
    if (e instanceof ForbiddenError) return { allow: false, reason: e.reason };
    throw e;
  }
}

// Ownership matrix from spec §5.4 / §9.1 (simplified binary role model).
// owner-only actions are already rejected by the OWNER_ONLY_ACTIONS gate in evaluate().
// baby-scoped read/write/trash/restore are fully governed by baby_member_permissions bits;
// the old "editor can only edit own entries" rule has been removed.
function checkOwnershipMatrix(
  _action: Action,
  _role: 'owner' | 'member',
  _userId: string,
  _resource: PermissionResource | undefined
): void {
  return;
}

export async function assertPermission(
  userId: string,
  action: Action,
  resource?: PermissionResource,
  opts: AssertPermissionOptions = {}
): Promise<void> {
  const dataDir = opts.dataDir
    ? resolve(opts.dataDir)
    : process.env.BABYLOOM_DATA_DIR
      ? resolve(process.env.BABYLOOM_DATA_DIR)
      : resolve(process.cwd(), 'data');

  const { db } = getDb({ dataDir });

  // 1. Membership lookup
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();

  if (!member) throw new ForbiddenError(action, 'not_family_member');

  const role: 'owner' | 'member' = member.role === 'owner' ? 'owner' : 'member';

  // 2. Cross-family check (always run when resource.babyId is set, regardless of bit)
  if (resource?.babyId) {
    const baby = db
      .select()
      .from(babies)
      .where(and(eq(babies.id, resource.babyId), eq(babies.familyId, member.familyId)))
      .get();
    if (!baby) throw new ForbiddenError(action, 'cross_family_baby');
  }

  if (action === 'member:manage' && resource?.targetUserId) {
    const targetMember = db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, resource.targetUserId))
      .get();
    if (!targetMember || targetMember.familyId !== member.familyId) {
      throw new ForbiddenError(action, 'target_not_in_family');
    }
  }

  // 3. Per-baby permission override — strict (spec §9.1).
  //   - Owner bypasses entirely.
  //   - Non-owner on baby-scoped action: MUST have a baby_member_permissions row
  //     (missing row = deny). Bits in that row are the sole authority for
  //     read/write/trash/restore. No author-ownership restrictions.
  let override: PermissionOverride | null = null;
  const bit = babyPermBit(action);
  if (bit && resource?.babyId) {
    override = db
      .select()
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.babyId, resource.babyId),
          eq(babyMemberPermissions.familyMemberId, member.id)
        )
      )
      .get() ?? null;
  }

  // 4. Final allow/deny
  const result = evaluate({ role, override, action, ownership: resource, userId });
  if (!result.allow) throw new ForbiddenError(action, result.reason);
}
