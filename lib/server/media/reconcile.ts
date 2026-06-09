import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, lt, notInArray } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { entryMedia, media } from '@/lib/server/db/schema';
import { stagingDir } from './paths';
import { purgeStagingDir } from './storage';

const STUCK_PENDING_MS = 60 * 60 * 1000;
const ORPHAN_READY_MS = 24 * 60 * 60 * 1000;

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

  // Backstop for entry-draft uploads the user abandoned without the frontend
  // cleaning up (closed the tab / lost network / partial attach failure). These
  // sit ready+unattached and would otherwise show in the gallery forever. Only
  // origin='entry_draft' media is eligible — 'standalone' (bulk-uploaded
  // historical photos) is deliberately unattached and must never be touched.
  db.update(media)
    .set({ status: 'trashed', deletedAt: opts.nowMs, deletedBy: null, updatedAt: opts.nowMs })
    .where(
      and(
        eq(media.status, 'ready'),
        eq(media.origin, 'entry_draft'),
        lt(media.createdAt, opts.nowMs - ORPHAN_READY_MS),
        notInArray(media.id, db.select({ id: entryMedia.mediaId }).from(entryMedia))
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
