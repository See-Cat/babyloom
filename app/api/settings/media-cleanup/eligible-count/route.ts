import { resolve } from 'node:path';
import { countEligibleOrphans } from '@/lib/server/media/reconcile';
import { withAuthorizedAction } from '@/lib/server/permissions/action-template';
import { getCleanupSettings } from '@/lib/server/settings/cleanup';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

// Live preview of how many orphans are currently eligible under the active
// threshold (D7) — computed on demand, never cached. The underlying count is a
// worker-scope query (PARENT-CHAIN-EXEMPT lives at the query in reconcile.ts).
export const GET = withAuthorizedAction({ action: 'system:settings' })(async () => {
  const { thresholdHours } = getCleanupSettings({ dataDir });
  const count = countEligibleOrphans({ dataDir, nowMs: Date.now(), thresholdHours });
  return Response.json({ count });
});
