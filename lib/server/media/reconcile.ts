import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { media } from '@/lib/server/db/schema';
import { stagingDir } from './paths';
import { purgeStagingDir } from './storage';

const STUCK_PENDING_MS = 60 * 60 * 1000;

export async function runReconcileOnce(opts: { dataDir: string; nowMs: number }): Promise<void> {
  const { db } = getDb({ dataDir: opts.dataDir });

  db.update(media)
    .set({ status: 'failed', updatedAt: opts.nowMs })
    .where(
      and(
        inArray(media.status, ['pending', 'processing']),
        lt(media.createdAt, opts.nowMs - STUCK_PENDING_MS)
      )
    )
    .run();

  const stagingRoot = join(opts.dataDir, 'media', '_staging');
  if (!existsSync(stagingRoot)) return;

  let names: string[];
  try {
    names = await readdir(stagingRoot);
  } catch {
    return;
  }

  for (const name of names) {
    const row = db.select({ status: media.status }).from(media).where(eq(media.id, name)).get();
    const keep = row && (row.status === 'pending' || row.status === 'processing');
    if (!keep) {
      await purgeStagingDir(stagingDir(opts.dataDir, name)).catch(() => {});
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startReconcileWorker(dataDir: string): void {
  if (timer) return;
  const tick = () => runReconcileOnce({ dataDir, nowMs: Date.now() }).catch(() => {});
  tick();
  timer = setInterval(tick, 24 * 60 * 60 * 1000);
  timer.unref?.();
}

export function stopReconcileWorkerForTesting(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
