import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies } from '@/lib/db/schema';
import type { Action, PermissionResource } from './actions';
import { NotFoundError } from './errors';
import { assertPermission } from './assert';
import { UUID_RE } from './responses';

export interface LoadAndAssertOptions {
  id: string;
  table: 'babies'; // expanded in P2/P3 to 'entries' | 'media' | 'milestones' | 'users'
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
    default:
      throw new Error(`unsupported table: ${opts.table}`);
  }

  if (!row) throw new NotFoundError(opts.table);

  if (opts.allowedStatuses && !opts.allowedStatuses.includes(row.status)) {
    throw new NotFoundError(opts.table);
  }

  const resource = opts.toResource ? opts.toResource(row) : { babyId: row.id };
  await assertPermission(opts.requirePermission.userId, opts.requirePermission.action, resource, {
    dataDir
  });

  return row as R;
}
