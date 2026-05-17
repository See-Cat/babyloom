import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { babies, entries, entryMedia, entryMilestones, media } from '@/lib/db/schema';
import { purgeFinalDir } from '@/lib/media/storage';

export function purgeEntry(dataDir: string, id: string) {
  const { db } = getDb({ dataDir });
  db.delete(entryMilestones).where(eq(entryMilestones.entryId, id)).run();
  db.delete(entryMedia).where(eq(entryMedia.entryId, id)).run();
  db.update(entries)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(entries.id, id))
    .run();
}

export async function purgeMedia(dataDir: string, id: string, relativePath?: string | null) {
  const { db } = getDb({ dataDir });
  db.delete(entryMedia).where(eq(entryMedia.mediaId, id)).run();
  db.update(media)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(media.id, id))
    .run();
  if (relativePath) {
    await purgeFinalDir(dataDir, relativePath).catch(() => {});
  }
}

export function countActiveBabyChildren(dataDir: string, babyId: string) {
  const { db } = getDb({ dataDir });
  const activeEntries = db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.babyId, babyId), eq(entries.status, 'active')))
    .all().length;
  const readyMedia = db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.babyId, babyId), eq(media.status, 'ready')))
    .all().length;
  return activeEntries + readyMedia;
}

export function purgeBaby(dataDir: string, id: string) {
  const childCount = countActiveBabyChildren(dataDir, id);
  if (childCount > 0) {
    return { purged: false as const, reason: 'has_active_children' };
  }

  const { db } = getDb({ dataDir });
  db.update(babies)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(babies.id, id))
    .run();
  return { purged: true as const };
}
