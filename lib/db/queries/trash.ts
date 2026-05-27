import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { babies, babyMemberPermissions, entries, entryMedia, entryMilestones, familyMembers, media, milestones, users } from '@/lib/db/schema';
import type { MediaItem } from '@/lib/media/types';

export type TrashType = 'entries' | 'media' | 'babies';
export type TrashListType = TrashType | 'all';

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
  mediaItems?: MediaItem[];
  milestoneNames?: string[];
  childCount?: number;
}

function afterCursor(rows: TrashRow[], cursor: string | null | undefined) {
  if (!cursor) return rows;
  const [deletedAtRaw, id] = cursor.split(':');
  const deletedAt = Number(deletedAtRaw);
  if (!Number.isFinite(deletedAt) || !id) return rows;
  return rows.filter((row) => row.deletedAt < deletedAt || (row.deletedAt === deletedAt && row.id < id));
}

// Per spec §9.1 (binary role model): a non-owner sees trash for ANY baby they
// hold `canDelete=1` on, regardless of who deleted the row. Returns an
// `inArray` constraint on `babyIdColumn`, or `undefined` for owner (no filter).
// For a member with zero canDelete rows, returns a `false` predicate so the
// query yields no rows (the route gate also rejects this case with 404).
function memberBabyScopeFilter(
  viewer: TrashViewer,
  dataDir: string,
  babyIdColumn: any
) {
  if (viewer.role === 'owner') return undefined;
  const allowedBabyIds = listBabiesWithCanDelete({ dataDir, userId: viewer.userId });
  if (allowedBabyIds.length === 0) {
    // empty IN () would be a SQL error; use a constraint that matches nothing.
    return eq(babyIdColumn, '__no_match__');
  }
  return inArray(babyIdColumn, allowedBabyIds);
}

function listBabiesWithCanDelete(opts: { dataDir: string; userId: string }): string[] {
  const { db } = getDb({ dataDir: opts.dataDir });
  const member = db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(eq(familyMembers.userId, opts.userId))
    .get();
  if (!member) return [];
  return db
    .select({ babyId: babyMemberPermissions.babyId })
    .from(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, member.id),
        eq(babyMemberPermissions.canDelete, 1)
      )
    )
    .all()
    .map((r) => r.babyId);
}

export function memberHasAnyCanDelete(opts: { dataDir: string; userId: string }): boolean {
  return listBabiesWithCanDelete(opts).length > 0;
}

export function listTrashed(opts: {
  type: TrashListType;
  cursor?: string | null;
  viewer: TrashViewer;
  dataDir: string;
  limit?: number;
}): TrashRow[] {
  const { db } = getDb({ dataDir: opts.dataDir });
  const limit = opts.limit ?? 51;

  if (opts.type === 'all') {
    const entriesRows = listTrashed({ ...opts, type: 'entries', cursor: null, limit: 10000 });
    const mediaRows = listTrashed({ ...opts, type: 'media', cursor: null, limit: 10000 });
    const merged = [...entriesRows, ...mediaRows].sort((a, b) => {
      if (b.deletedAt !== a.deletedAt) return b.deletedAt - a.deletedAt;
      return b.id.localeCompare(a.id);
    });
    return afterCursor(merged, opts.cursor).slice(0, limit);
  }

  if (opts.type === 'entries') {
    const baseRows = db
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
          memberBabyScopeFilter(opts.viewer, opts.dataDir, entries.babyId)
        )
      )
      .orderBy(desc(entries.deletedAt), desc(entries.id))
      .all();

    const entryIds = baseRows.map((r) => r.id);
    const mediaByEntry = new Map<string, MediaItem[]>();
    const milestonesByEntry = new Map<string, string[]>();
    if (entryIds.length > 0) {
      const links = db
        .select({
          entryId: entryMedia.entryId,
          mediaId: entryMedia.mediaId,
          type: media.type,
          durationSec: media.durationSec,
          filename: media.filename,
          attachedAt: entryMedia.attachedAt
        })
        .from(entryMedia)
        .innerJoin(media, eq(media.id, entryMedia.mediaId))
        .where(
          and(
            inArray(entryMedia.entryId, entryIds),
            inArray(media.status, ['ready', 'trashed'])
          )
        )
        .orderBy(entryMedia.attachedAt)
        .all();
      for (const link of links) {
        const arr = mediaByEntry.get(link.entryId) ?? [];
        arr.push({
          id: link.mediaId,
          type: (link.type as 'photo' | 'video' | null) ?? 'photo',
          durationSec: link.durationSec,
          filename: link.filename
        });
        mediaByEntry.set(link.entryId, arr);
      }

      const mlinks = db
        .select({ entryId: entryMilestones.entryId, name: milestones.name })
        .from(entryMilestones)
        .innerJoin(milestones, eq(milestones.id, entryMilestones.milestoneId))
        .where(inArray(entryMilestones.entryId, entryIds))
        .all();
      for (const m of mlinks) {
        const arr = milestonesByEntry.get(m.entryId) ?? [];
        arr.push(m.name);
        milestonesByEntry.set(m.entryId, arr);
      }
    }

    const rows = baseRows.map((row) => ({
      ...row,
      type: 'entries' as const,
      deletedAt: row.deletedAt ?? 0,
      mediaItems: mediaByEntry.get(row.id) ?? [],
      milestoneNames: milestonesByEntry.get(row.id) ?? []
    }));
    return afterCursor(rows, opts.cursor).slice(0, limit);
  }

  if (opts.type === 'media') {
    // standalone (bulk-uploaded) trashed media only: exclude any media that
    // is attached to an entry, since entry cards already render attached
    // thumbnails inline.
    const attachedMediaIds = db
      .select({ mediaId: entryMedia.mediaId })
      .from(entryMedia)
      .all()
      .map((r) => r.mediaId);

    const rows = db
      .select({
        id: media.id,
        babyId: media.babyId,
        babyName: babies.name,
        deletedAt: media.deletedAt,
        deletedBy: media.deletedBy,
        deletedByName: users.name,
        label: media.filename,
        mediaType: media.type,
        durationSec: media.durationSec
      })
      .from(media)
      .innerJoin(babies, eq(babies.id, media.babyId))
      .leftJoin(users, eq(users.id, media.deletedBy))
      .where(
        and(
          eq(media.status, 'trashed'),
          eq(babies.familyId, opts.viewer.familyId),
          inArray(babies.status, ['active', 'trashed']),
          memberBabyScopeFilter(opts.viewer, opts.dataDir, media.babyId),
          attachedMediaIds.length > 0 ? notInArray(media.id, attachedMediaIds) : sql`1=1`
        )
      )
      .orderBy(desc(media.deletedAt), desc(media.id))
      .all()
      .map((row) => ({
        id: row.id,
        babyId: row.babyId,
        babyName: row.babyName,
        deletedAt: row.deletedAt ?? 0,
        deletedBy: row.deletedBy,
        deletedByName: row.deletedByName,
        label: row.label,
        type: 'media' as const,
        mediaItems: [
          {
            id: row.id,
            type: (row.mediaType as 'photo' | 'video' | null) ?? 'photo',
            durationSec: row.durationSec,
            filename: row.label
          }
        ]
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
        memberBabyScopeFilter(opts.viewer, opts.dataDir, babies.id)
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
