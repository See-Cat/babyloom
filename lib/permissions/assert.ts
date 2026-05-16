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
const OWNER_ONLY_ACTIONS = new Set<Action>([
  'baby:write',
  'baby:trash',
  'baby:restore',
  'baby:purge',
  'entry:purge',
  'media:purge',
  'member:manage',
  'family:manage',
  'milestone:manage',
  'system:logs',
  'system:backup'
]);

// Map an Action to the (canRead | canWrite | canDelete) bit it needs against baby_member_permissions.
// Returns null when the action is owner-only OR not baby-scoped — override cannot apply.
function babyPermBit(action: Action): 'canRead' | 'canWrite' | 'canDelete' | null {
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

// Ownership matrix from spec §5.4.
function checkOwnershipMatrix(
  action: Action,
  role: 'owner' | 'editor' | 'viewer',
  userId: string,
  resource: PermissionResource | undefined
): void {
  if (role === 'owner') return; // owner bypasses ownership checks

  switch (action) {
    // viewer: read-only on baby/entry/media scope (see baby_member_permissions step)
    case 'baby:read':
    case 'entry:read':
    case 'media:read':
    case 'trash:view':
      return; // viewer + editor allowed; finer scope handled by baby_member_permissions

    // editor: write/trash own only
    case 'entry:write':
    case 'entry:trash':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      if (!resource?.authorId || resource.authorId !== userId)
        throw new ForbiddenError(action, 'editor_not_author');
      return;

    case 'media:write':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      return; // editor allowed for any baby they have media:write on

    case 'media:trash':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      if (!resource?.uploadedBy || resource.uploadedBy !== userId)
        throw new ForbiddenError(action, 'editor_not_uploader');
      return;

    // restore: must be own AND must have been the one who trashed it
    case 'entry:restore':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_restore');
      if (!resource?.authorId || resource.authorId !== userId)
        throw new ForbiddenError(action, 'editor_not_author');
      if (!resource?.deletedBy || resource.deletedBy !== userId)
        throw new ForbiddenError(action, 'editor_did_not_delete');
      return;

    case 'media:restore':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_restore');
      if (!resource?.uploadedBy || resource.uploadedBy !== userId)
        throw new ForbiddenError(action, 'editor_not_uploader');
      if (!resource?.deletedBy || resource.deletedBy !== userId)
        throw new ForbiddenError(action, 'editor_did_not_delete');
      return;

    // purge: owner only — already rejected above for editor/viewer
    case 'entry:purge':
    case 'media:purge':
    case 'baby:trash':
    case 'baby:restore':
    case 'baby:purge':
    case 'member:manage':
    case 'family:manage':
    case 'baby:write':
    case 'milestone:manage':
    case 'system:logs':
    case 'system:backup':
      throw new ForbiddenError(action, 'owner_only');

    default:
      // Exhaustiveness — should never hit
      throw new ForbiddenError(action, 'unhandled_action');
  }
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

  const role = member.role as 'owner' | 'editor' | 'viewer';

  // 2. Cross-family check (always run when resource.babyId is set, regardless of bit)
  if (resource?.babyId) {
    const baby = db
      .select()
      .from(babies)
      .where(and(eq(babies.id, resource.babyId), eq(babies.familyId, member.familyId)))
      .get();
    if (!baby) throw new ForbiddenError(action, 'cross_family_baby');
  }

  // 3. Per-baby permission override — ONLY a scope gate, NEVER a grant (spec §5.3)
  //
  //   - For owner-only actions: babyPermBit() returns null; override is skipped entirely.
  //     The action falls through to checkOwnershipMatrix which enforces 'owner_only'.
  //   - For non-owner-only actions with override row present: a `0` bit DENIES the action
  //     (narrowing semantics — owner has explicitly removed the role-granted permission
  //     for this specific baby). A `1` bit lets execution fall through to the role
  //     matrix; it does NOT short-circuit allow.
  //   - No override row → fall through to role matrix (override is opt-in).
  //
  // Codex round 10 finding #1: removing the early `return` here was the entire fix.
  const bit = babyPermBit(action);
  if (bit && resource?.babyId) {
    const override = db
      .select()
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.babyId, resource.babyId),
          eq(babyMemberPermissions.familyMemberId, member.id)
        )
      )
      .get();

    if (override && override[bit] !== 1) {
      throw new ForbiddenError(action, `baby_perm_${bit}_denied`);
    }
    // Either no override (default allow per role) or override allows — fall through.
  }

  // 4. Role-based ownership matrix — final authority on allow/deny
  checkOwnershipMatrix(action, role, userId, resource);
}
