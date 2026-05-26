import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { babies, entries, media, users } from '@/lib/db/schema';

export type TrashType = 'entries' | 'media' | 'babies';

export interface TrashViewer {
  userId: string;
  familyId: string;
  role: 'owner' | 'member';
}

export interface TrashRow {
  id: string;
  type: TrashType;
  babyId: string | null;
  babyName: string | null;
  deletedAt: number;
  deletedBy: string | null;
  deletedByName: string | null;
  label: string;
  childCount?: number;
}

function afterCursor(rows: TrashRow[], cursor: string | null | undefined) {
  if (!cursor) return rows;
  const [deletedAtRaw, id] = cursor.split(':');
  const deletedAt = Number(deletedAtRaw);
  if (!Number.isFinite(deletedAt) || !id) return rows;
  return rows.filter((row) => row.deletedAt < deletedAt || (row.deletedAt === deletedAt && row.id < id));
}

function editorFilter(viewer: TrashViewer, deletedBy: any) {
  return viewer.role === 'owner' ? undefined : eq(deletedBy, viewer.userId);
}

export function listTrashed(opts: {
  type: TrashType;
  cursor?: string | null;
  viewer: TrashViewer;
  dataDir: string;
  limit?: number;
}): TrashRow[] {
  const { db } = getDb({ dataDir: opts.dataDir });
  const limit = opts.limit ?? 51;

  if (opts.type === 'entries') {
    const rows = db
      .select({
        id: entries.id,
        babyId: entries.babyId,
        babyName: babies.name,
        deletedAt: entries.deletedAt,
        deletedBy: entries.deletedBy,
        deletedByName: users.name,
        label: entries.content
      })
      .from(entries)
      .innerJoin(babies, eq(babies.id, entries.babyId))
      .leftJoin(users, eq(users.id, entries.deletedBy))
      .where(
        and(
          eq(entries.status, 'trashed'),
          eq(babies.familyId, opts.viewer.familyId),
          inArray(babies.status, ['active', 'trashed']),
          editorFilter(opts.viewer, entries.deletedBy)
        )
      )
      .orderBy(desc(entries.deletedAt), desc(entries.id))
      .all()
      .map((row) => ({
        ...row,
        type: 'entries' as const,
        deletedAt: row.deletedAt ?? 0
      }));
    return afterCursor(rows, opts.cursor).slice(0, limit);
  }

  if (opts.type === 'media') {
    const rows = db
      .select({
        id: media.id,
        babyId: media.babyId,
        babyName: babies.name,
        deletedAt: media.deletedAt,
        deletedBy: media.deletedBy,
        deletedByName: users.name,
        label: media.filename
      })
      .from(media)
      .innerJoin(babies, eq(babies.id, media.babyId))
      .leftJoin(users, eq(users.id, media.deletedBy))
      .where(
        and(
          eq(media.status, 'trashed'),
          eq(babies.familyId, opts.viewer.familyId),
          inArray(babies.status, ['active', 'trashed']),
          editorFilter(opts.viewer, media.deletedBy)
        )
      )
      .orderBy(desc(media.deletedAt), desc(media.id))
      .all()
      .map((row) => ({
        ...row,
        type: 'media' as const,
        deletedAt: row.deletedAt ?? 0
      }));
    return afterCursor(rows, opts.cursor).slice(0, limit);
  }

  const rows = db
    .select({
      id: babies.id,
      babyName: babies.name,
      deletedAt: babies.deletedAt,
      deletedBy: babies.deletedBy,
      deletedByName: users.name
    })
    .from(babies)
    .leftJoin(users, eq(users.id, babies.deletedBy))
    .where(
      and(
        eq(babies.status, 'trashed'),
        eq(babies.familyId, opts.viewer.familyId),
        editorFilter(opts.viewer, babies.deletedBy)
      )
    )
    .orderBy(desc(babies.deletedAt), desc(babies.id))
    .all()
    .map((row) => ({
      id: row.id,
      type: 'babies' as const,
      babyId: row.id,
      babyName: row.babyName,
      deletedAt: row.deletedAt ?? 0,
      deletedBy: row.deletedBy,
      deletedByName: row.deletedByName,
      label: row.babyName,
      childCount: countLiveChildren(opts.dataDir, row.id)
    }));
  return afterCursor(rows, opts.cursor).slice(0, limit);
}

export function countTrashedByType(opts: { viewer: TrashViewer; dataDir: string }) {
  return {
    entries: listTrashed({ type: 'entries', viewer: opts.viewer, dataDir: opts.dataDir, limit: 10000 }).length,
    media: listTrashed({ type: 'media', viewer: opts.viewer, dataDir: opts.dataDir, limit: 10000 }).length,
    babies: listTrashed({ type: 'babies', viewer: opts.viewer, dataDir: opts.dataDir, limit: 10000 }).length
  };
}

export function countLiveChildren(dataDir: string, babyId: string) {
  const { db } = getDb({ dataDir });
  const activeEntries = db
    .select({ id: entries.id })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(and(eq(entries.babyId, babyId), eq(entries.status, 'active')))
    .all().length;
  const readyMedia = db
    .select({ id: media.id })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .where(and(eq(media.babyId, babyId), eq(media.status, 'ready')))
    .all().length;
  return activeEntries + readyMedia;
}
