import { and, desc, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { babies, entryMedia, media } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';

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
  limitMonths = 12
}: {
  db: BetterSQLite3Database<typeof schema>;
  babyId: string;
  limitMonths?: number;
}): GalleryMedia[] {
  const cutoff = monthCutoff(limitMonths);
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
      entryId: entryMedia.entryId
    })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .leftJoin(entryMedia, eq(entryMedia.mediaId, media.id))
    .where(and(eq(media.babyId, babyId), eq(media.status, 'ready'), eq(babies.status, 'active')))
    .orderBy(desc(sortExpr))
    .all();

  return rows.filter((row) => (row.takenAt ?? row.createdAt) >= cutoff);
}

export function groupMediaByMonth<T extends { takenAt: number | null; createdAt: number }>(
  rows: T[]
): Array<GalleryMonthGroup<T>> {
  const groups = new Map<string, GalleryMonthGroup<T>>();

  for (const row of [...rows].sort((a, b) => (b.takenAt ?? b.createdAt) - (a.takenAt ?? a.createdAt))) {
    const effective = new Date(row.takenAt ?? row.createdAt);
    const year = effective.getUTCFullYear();
    const month = effective.getUTCMonth() + 1;
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

function monthCutoff(limitMonths: number) {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Math.max(limitMonths - 1, 0), 1);
}
