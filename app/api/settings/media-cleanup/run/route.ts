import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { runReconcileOnce } from '@/lib/server/media/reconcile';
import { withAuthorizedAction } from '@/lib/server/permissions/action-template';
import { jsonServiceUnavailable } from '@/lib/server/permissions/responses';
import { getCleanupSettings } from '@/lib/server/settings/cleanup';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export const POST = withAuthorizedAction({ action: 'system:settings' })(async () => {
  // Owner-facing UX layer for the env kill-switch. The actual no-op is enforced
  // inside runReconcileOnce (the primitive) regardless; this surfaces it as 503.
  if (process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE === '1') {
    return jsonServiceUnavailable('reconcile_disabled', 3600);
  }
  assertWritesAllowed(); // 503 during a backup; trashes nothing

  // A manual run is an explicit owner action: it bypasses the DB enabled flag but
  // still honors the higher-tier guards (env kill-switch above, backup barrier
  // here and inside the primitive). One shared cleanup primitive — no duplication.
  const result = await runReconcileOnce({ dataDir, nowMs: Date.now(), mode: 'manual' });

  // Honor the primitive's skip contract. The primitive enforces the same guards
  // (backup barrier, env kill-switch) at its top; if it reports a skip, surface
  // 503 rather than a phantom success with stale stats. Today the manual path is
  // synchronous so this can't trip behind the route's own pre-checks, but the
  // route consumes the documented `skipped` signal instead of assuming it false.
  if (result.skipped) {
    return jsonServiceUnavailable('reconcile_unavailable', 3600);
  }

  const settings = getCleanupSettings({ dataDir });
  return Response.json({
    orphansTrashed: result.orphansTrashed,
    lastRunAt: settings.lastRunAt,
    lastRunDeleted: settings.lastRunDeleted
  });
});
