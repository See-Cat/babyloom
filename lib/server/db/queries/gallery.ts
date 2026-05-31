import { and, desc, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { babies, entryMedia, media } from '@/lib/server/db/schema';
import type * as schema from '@/lib/server/db/schema';
import { parseBirthdayToMillis, zonedParts } from '@/lib/shared/format-time';

export interface GalleryMedia {
  id: string;
  type: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  filename: string;
  takenAt: number | null;
  createdAt: number;
  entryId: string | null;
}

export interface GalleryMonthGroup<T extends { takenAt: number | null; createdAt: number }> {
  ym: string;
  label: string;
  items: T[];
}

export function listGalleryMedia({
  db,
  babyId,
  timeZone
}: {
  db: BetterSQLite3Database<typeof schema>;
  babyId: string;
  timeZone: string;
}): GalleryMedia[] {
  const sortExpr = sql<number>`coalesce(${media.takenAt}, ${media.createdAt})`;
  const rows = db
    .select({
      id: media.id,
      type: media.type,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      durationSec: media.durationSec,
      filename: media.filename,
      takenAt: media.takenAt,
      createdAt: media.createdAt,
      entryId: entryMedia.entryId,
      birthday: babies.birthday
    })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .leftJoin(entryMedia, eq(entryMedia.mediaId, media.id))
    .where(and(eq(media.babyId, babyId), eq(media.status, 'ready'), eq(babies.status, 'active')))
    .orderBy(desc(sortExpr))
    .all();

  const birthdayMs = rows[0] ? parseBirthdayToMillis(rows[0].birthday, timeZone) : null;

  const seen = new Set<string>();
  const deduped: GalleryMedia[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const takenAt = row.takenAt != null && birthdayMs != null && row.takenAt < birthdayMs ? null : row.takenAt;
    deduped.push({
      id: row.id,
      type: row.type,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      durationSec: row.durationSec,
      filename: row.filename,
      takenAt,
      createdAt: row.createdAt,
      entryId: row.entryId
    });
  }
  return deduped;
}

export function groupMediaByMonth<T extends { takenAt: number | null; createdAt: number }>(
  rows: T[],
  timeZone: string
): Array<GalleryMonthGroup<T>> {
  const groups = new Map<string, GalleryMonthGroup<T>>();

  for (const row of [...rows].sort((a, b) => (b.takenAt ?? b.createdAt) - (a.takenAt ?? a.createdAt))) {
    // Bucket by the month in the configured timezone, so a shot near local midnight
    // files under the day the family experienced it (not the UTC month).
    const { year, month } = zonedParts(row.takenAt ?? row.createdAt, timeZone);
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    let group = groups.get(ym);
    if (!group) {
      group = { ym, label: `${year} 年 ${month} 月`, items: [] };
      groups.set(ym, group);
    }
    group.items.push(row);
  }

  return Array.from(groups.values());
}
