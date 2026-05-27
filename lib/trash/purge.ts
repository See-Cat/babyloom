import { rename } from 'node:fs/promises';
import { join } from 'node:path';
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

// 宝宝"永久删除"实际上是归档:
// - babies.status -> 'purged' 让所有查询过滤掉;
// - data/media/<babyId> 整目录 rename 为 <babyId>_archived, 保留所有原始文件.
// 没有任何 rm 操作, 真删需要人工进数据库 + 文件系统.
export async function purgeBaby(dataDir: string, id: string) {
  const { db } = getDb({ dataDir });
  const previous = db.select({ status: babies.status }).from(babies).where(eq(babies.id, id)).get();
  if (!previous) return { purged: false as const, reason: 'not_found' };

  db.update(babies).set({ status: 'purged', updatedAt: Date.now() }).where(eq(babies.id, id)).run();

  try {
    await archiveBabyMediaDir(dataDir, id);
  } catch {
    db.update(babies)
      .set({ status: previous.status, updatedAt: Date.now() })
      .where(eq(babies.id, id))
      .run();
    return { purged: false as const, reason: 'archive_failed' };
  }

  return { purged: true as const };
}

async function archiveBabyMediaDir(dataDir: string, babyId: string): Promise<void> {
  const src = join(dataDir, 'media', babyId);
  const dest = join(dataDir, 'media', `${babyId}_archived`);
  try {
    await rename(src, dest);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return;
    throw err;
  }
}
