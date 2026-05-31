import { and, eq, inArray, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/server/db/schema';
import { entries, entryMedia, media } from '@/lib/server/db/schema';

type Db = BetterSQLite3Database<typeof schema>;

/**
 * When an entry is trashed, cascade its attached photos/videos to the trash so
 * they leave the gallery (which only shows status='ready' media). A media that
 * is still attached to ANOTHER active entry is kept — only media left with no
 * active entry is trashed. Standalone media (bulk-uploaded, no entry) is never
 * touched here because it is not attached to this entry.
 */
export function cascadeTrashEntryMedia(db: Db, entryId: string, userId: string, now: number): void {
  const attached = db
    .select({ mediaId: entryMedia.mediaId })
    .from(entryMedia)
    .where(eq(entryMedia.entryId, entryId))
    .all()
    .map((r) => r.mediaId);
  if (attached.length === 0) return;

  const keep = new Set(
    db
      .select({ mediaId: entryMedia.mediaId })
      .from(entryMedia)
      .innerJoin(entries, eq(entries.id, entryMedia.entryId))
      .where(
        and(
          inArray(entryMedia.mediaId, attached),
          ne(entryMedia.entryId, entryId),
          eq(entries.status, 'active')
        )
      )
      .all()
      .map((r) => r.mediaId)
  );

  const toTrash = attached.filter((id) => !keep.has(id));
  if (toTrash.length === 0) return;

  db.update(media)
    .set({ status: 'trashed', deletedAt: now, deletedBy: userId, updatedAt: now })
    .where(and(inArray(media.id, toTrash), eq(media.status, 'ready')))
    .run();
}

/**
 * When an entry is restored, bring its trashed photos/videos back to the
 * gallery. Mirrors {@link cascadeTrashEntryMedia}: restores media attached to
 * this entry that are currently trashed.
 */
export function cascadeRestoreEntryMedia(db: Db, entryId: string, now: number): void {
  const attached = db
    .select({ mediaId: entryMedia.mediaId })
    .from(entryMedia)
    .where(eq(entryMedia.entryId, entryId))
    .all()
    .map((r) => r.mediaId);
  if (attached.length === 0) return;

  db.update(media)
    .set({ status: 'ready', deletedAt: null, deletedBy: null, updatedAt: now })
    .where(and(inArray(media.id, attached), eq(media.status, 'trashed')))
    .run();
}
