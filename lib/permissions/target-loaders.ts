import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies, entries } from '@/lib/db/schema';
import type { Action, PermissionResource } from './actions';
import { NotFoundError } from './errors';
import { assertPermission } from './assert';
import { UUID_RE } from './responses';

export interface LoadAndAssertOptions {
  id: string;
  table: 'babies' | 'entries' | 'milestones' | 'users';
  allowedStatuses?: string[];
  requirePermission: { userId: string; action: Action };
  toResource?: (row: any) => PermissionResource;
  dataDir?: string;
}

// Generic loader. Returns the DB row on success, throws NotFoundError on any
// shape/existence/status/cross-scope failure. ForbiddenError from
// assertPermission also escapes — the caller is responsible for translating
// both to a unified 404 (§5.6).
export async function loadAndAssertTarget<R = unknown>(
  opts: LoadAndAssertOptions
): Promise<R> {
  if (!UUID_RE.test(opts.id)) throw new NotFoundError(opts.table);

  const dataDir = opts.dataDir
    ? resolve(opts.dataDir)
    : process.env.BABYLOOM_DATA_DIR
      ? resolve(process.env.BABYLOOM_DATA_DIR)
      : resolve(process.cwd(), 'data');

  const { db } = getDb({ dataDir });

  let row: any;
  switch (opts.table) {
    case 'babies':
      row = db.select().from(babies).where(eq(babies.id, opts.id)).get();
      break;
    case 'entries':
      row = db
        .select({
          id: entries.id,
          babyId: entries.babyId,
          authorId: entries.authorId,
          content: entries.content,
          occurredAt: entries.occurredAt,
          status: entries.status,
          createdAt: entries.createdAt,
          updatedAt: entries.updatedAt,
          deletedAt: entries.deletedAt,
          deletedBy: entries.deletedBy,
          babyStatus: babies.status
        })
        .from(entries)
        .innerJoin(babies, eq(babies.id, entries.babyId))
        .where(eq(entries.id, opts.id))
        .get();
      if (row && row.babyStatus !== 'active') {
        row = null;
      }
      break;
    case 'milestones': {
      const { milestones } = await import('@/lib/db/schema');
      row = db.select().from(milestones).where(eq(milestones.id, opts.id)).get();
      break;
    }
    case 'users': {
      // This branch is only safe for action='member:manage'. Do not extend it
      // to baby-scoped actions without adding a baby-aware resource mapping.
      const { users } = await import('@/lib/db/schema');
      row = db.select().from(users).where(eq(users.id, opts.id)).get();
      break;
    }
    default:
      throw new Error(`unsupported table: ${opts.table}`);
  }

  if (!row) throw new NotFoundError(opts.table);

  if (opts.allowedStatuses && !opts.allowedStatuses.includes(row.status)) {
    throw new NotFoundError(opts.table);
  }

  const defaultResource = (target: any): PermissionResource => {
    switch (opts.table) {
      case 'babies':
        return { babyId: target.id };
      case 'entries':
        return {
          babyId: target.babyId,
          entryId: target.id,
          authorId: target.authorId,
          deletedBy: target.deletedBy ?? undefined
        };
      case 'milestones':
        return {};
      case 'users':
        return { targetUserId: target.id };
    }
  };
  const resource = opts.toResource ? opts.toResource(row) : defaultResource(row);
  await assertPermission(opts.requirePermission.userId, opts.requirePermission.action, resource, {
    dataDir
  });

  return row as R;
}
