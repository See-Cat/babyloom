import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { babies, entries, media } from '@/lib/db/schema';
import type { TrashType } from '@/lib/db/queries/trash';
import { purgeBaby, purgeEntry, purgeMedia } from './purge';

export interface EmptyTrashResult {
  purged: number;
  skipped: Array<{ id: string; reason: string }>;
}

export async function bulkPurgeByType(opts: {
  type: TrashType;
  familyId: string;
  dataDir: string;
}): Promise<EmptyTrashResult> {
  const { db } = getDb({ dataDir: opts.dataDir });
  let purged = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  if (opts.type === 'entries') {
    const rows = db
      .select({ id: entries.id })
      .from(entries)
      .innerJoin(babies, eq(babies.id, entries.babyId))
      .where(
        and(
          eq(entries.status, 'trashed'),
          eq(babies.familyId, opts.familyId),
          inArray(babies.status, ['active', 'trashed'])
        )
      )
      .all();
    for (const row of rows) {
      purgeEntry(opts.dataDir, row.id);
      purged += 1;
    }
    return { purged, skipped };
  }

  if (opts.type === 'media') {
    const rows = db
      .select({ id: media.id, relativePath: media.relativePath })
      .from(media)
      .innerJoin(babies, eq(babies.id, media.babyId))
      .where(
        and(
          eq(media.status, 'trashed'),
          eq(babies.familyId, opts.familyId),
          inArray(babies.status, ['active', 'trashed'])
        )
      )
      .all();
    for (const row of rows) {
      await purgeMedia(opts.dataDir, row.id, row.relativePath);
      purged += 1;
    }
    return { purged, skipped };
  }

  const rows = db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.status, 'trashed'), eq(babies.familyId, opts.familyId)))
    .all();
  for (const row of rows) {
    const result = await purgeBaby(opts.dataDir, row.id);
    if (result.purged) purged += 1;
    else skipped.push({ id: row.id, reason: result.reason });
  }
  return { purged, skipped };
}
