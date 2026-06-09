import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/server/db/client';
import { babies, entries, media } from '@/lib/server/db/schema';
import type { Action, PermissionResource } from './actions';
import { NotFoundError } from './errors';
import { assertPermission } from './assert';
import { UUID_RE } from './responses';

export interface LoadAndAssertOptions {
  id: string;
  table: 'babies' | 'entries' | 'media' | 'milestones' | 'users';
  allowedStatuses?: string[];
  allowedParentStatuses?: string[];
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
      if (row && !(opts.allowedParentStatuses ?? ['active']).includes(row.babyStatus)) {
        row = null;
      }
      break;
    case 'media':
      row = db
        .select({
          id: media.id,
          babyId: media.babyId,
          uploadedBy: media.uploadedBy,
          clientUploadId: media.clientUploadId,
          type: media.type,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          contentHash: media.contentHash,
          width: media.width,
          height: media.height,
          durationSec: media.durationSec,
          relativePath: media.relativePath,
          originalExt: media.originalExt,
          filename: media.filename,
          takenAt: media.takenAt,
          status: media.status,
          origin: media.origin,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
          deletedAt: media.deletedAt,
          deletedBy: media.deletedBy,
          babyStatus: babies.status
        })
        .from(media)
        .innerJoin(babies, eq(babies.id, media.babyId))
        .where(eq(media.id, opts.id))
        .get();
      if (row && !(opts.allowedParentStatuses ?? ['active']).includes(row.babyStatus)) {
        row = null;
      }
      break;
    case 'milestones': {
      const { milestones } = await import('@/lib/server/db/schema');
      row = db.select().from(milestones).where(eq(milestones.id, opts.id)).get();
      break;
    }
    case 'users': {
      // This branch is only safe for action='member:manage'. Do not extend it
      // to baby-scoped actions without adding a baby-aware resource mapping.
      const { users } = await import('@/lib/server/db/schema');
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
      case 'media':
        return {
          babyId: target.babyId,
          mediaId: target.id,
          uploadedBy: target.uploadedBy,
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
