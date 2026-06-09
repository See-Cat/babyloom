import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, lt, notInArray, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { entryMedia, media } from '@/lib/server/db/schema';
import { isBackupInProgress } from '@/lib/server/backup/write-barrier';
import { getCleanupSettings, recordCleanupRun } from '@/lib/server/settings/cleanup';
import { stagingDir } from './paths';
import { purgeStagingDir } from './storage';

const STUCK_PENDING_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type ReconcileMode = 'scheduled' | 'manual';

export interface ReconcileResult {
  skipped: boolean;
  orphansTrashed: number;
}

type Db = ReturnType<typeof getDb>['db'];

// Orphan eligibility — the single source of truth shared by the cleanup write
// and the live preview count so the two never drift. Only origin='entry_draft'
// ready media older than the cutoff with no entry_media row is eligible;
// 'standalone' (bulk-uploaded historical photos) is deliberately unattached and
// must never be touched.
function orphanEligibility(db: Db, cutoffMs: number): SQL {
  return and(
    eq(media.status, 'ready'),
    eq(media.origin, 'entry_draft'),
    lt(media.createdAt, cutoffMs),
    notInArray(media.id, db.select({ id: entryMedia.mediaId }).from(entryMedia))
  ) as SQL;
}

// Live count of media currently eligible for cleanup under the given threshold,
// for the owner panel preview (D7). Computed on demand, never cached.
// PARENT-CHAIN-EXEMPT: worker-scope janitor count over all families' media by
// origin/age (mirrors the cleanup's own scope), not tenant-scoped.
export function countEligibleOrphans(opts: {
  dataDir: string;
  nowMs: number;
  thresholdHours: number;
}): number {
  const { db } = getDb({ dataDir: opts.dataDir });
  const cutoff = opts.nowMs - opts.thresholdHours * HOUR_MS;
  const row = db
    .select({ c: sql<number>`count(*)`.as('c') })
    .from(media)
    .where(orphanEligibility(db, cutoff))
    .get();
  return row?.c ?? 0;
}

// The shared cleanup primitive. Every entry point (scheduled tick, owner run-now,
// any future caller) goes through here, so the highest-tier guards are enforced
// at the TOP of this function rather than per-caller:
//   1. backup write barrier — skip the whole tick while a backup is in progress.
//   2. env kill-switch — BABYLOOM_DISABLE_MEDIA_RECONCILE overrides everything.
// Below the guards:
//   - The orphan-media cleanup runs when mode==='manual' OR the stored enabled
//     flag is on, using the configured threshold, and records run stats.
//   - The internal hygiene (stuck-`pending` recovery + staging GC) is a
//     BACKGROUND concern and runs only on the scheduled tick. A manual run is
//     the owner's "立即清理" action and is deliberately scoped to ONLY the
//     orphan-draft cleanup the panel describes, so it cannot recover/purge
//     another member's still-`processing` upload + its staging dir.
export async function runReconcileOnce(opts: {
  dataDir: string;
  nowMs: number;
  mode?: ReconcileMode;
}): Promise<ReconcileResult> {
  if (isBackupInProgress() || process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE === '1') {
    return { skipped: true, orphansTrashed: 0 };
  }

  const mode: ReconcileMode = opts.mode ?? 'scheduled';
  const isScheduled = mode === 'scheduled';
  const { db } = getDb({ dataDir: opts.dataDir });

  if (isScheduled) {
    db.update(media)
      .set({ status: 'failed', updatedAt: opts.nowMs })
      .where(
        and(
          inArray(media.status, ['pending', 'processing']),
          lt(media.createdAt, opts.nowMs - STUCK_PENDING_MS)
        )
      )
      .run();
  }

  // Backstop for entry-draft uploads the user abandoned without the frontend
  // cleaning up (closed the tab / lost network / partial attach failure). These
  // sit ready+unattached and would otherwise show in the gallery forever. The
  // step is governed by the owner's enabled flag, except a manual run (explicit
  // owner action) executes it regardless. Threshold comes from settings.
  const settings = getCleanupSettings({ dataDir: opts.dataDir });
  let orphansTrashed = 0;
  if (mode === 'manual' || settings.enabled) {
    const cutoff = opts.nowMs - settings.thresholdHours * HOUR_MS;
    // Atomic: "trash N media" and "record that we trashed N" commit together. If
    // the run-stat write fails, the soft-delete rolls back too — never a state
    // where media is trashed but the stats (and a later retry's count) don't
    // reflect it. better-sqlite3 runs this synchronously on the single connection.
    db.transaction((tx) => {
      const res = tx
        .update(media)
        .set({ status: 'trashed', deletedAt: opts.nowMs, deletedBy: null, updatedAt: opts.nowMs })
        .where(orphanEligibility(db, cutoff))
        .run();
      orphansTrashed = res.changes;
      recordCleanupRun({ dataDir: opts.dataDir, runAtMs: opts.nowMs, deletedCount: orphansTrashed });
    });
  }

  if (!isScheduled) return { skipped: false, orphansTrashed };

  const stagingRoot = join(opts.dataDir, 'media', '_staging');
  if (!existsSync(stagingRoot)) return { skipped: false, orphansTrashed };

  let names: string[];
  try {
    names = await readdir(stagingRoot);
  } catch {
    return { skipped: false, orphansTrashed };
  }

  for (const name of names) {
    const row = db.select({ status: media.status }).from(media).where(eq(media.id, name)).get();
    const keep = row && (row.status === 'pending' || row.status === 'processing');
    if (!keep) {
      await purgeStagingDir(stagingDir(opts.dataDir, name)).catch(() => {});
    }
  }

  return { skipped: false, orphansTrashed };
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
