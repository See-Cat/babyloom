import { resolve } from 'node:path';
import { z } from 'zod';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { withAuthorizedAction } from '@/lib/server/permissions/action-template';
import { jsonBadRequest } from '@/lib/server/permissions/responses';
import {
  MAX_THRESHOLD_HOURS,
  MIN_THRESHOLD_HOURS,
  ThresholdValidationError,
  getCleanupSettings,
  updateCleanupSettings,
  type CleanupSettings
} from '@/lib/server/settings/cleanup';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

function withLimits(s: CleanupSettings) {
  return { ...s, minThresholdHours: MIN_THRESHOLD_HOURS, maxThresholdHours: MAX_THRESHOLD_HOURS };
}

export const GET = withAuthorizedAction({ action: 'system:settings' })(async () => {
  return Response.json(withLimits(getCleanupSettings({ dataDir })));
});

const putSchema = z.object({
  enabled: z.boolean().optional(),
  thresholdHours: z.number().int().optional()
});

export const PUT = withAuthorizedAction({ action: 'system:settings' })(async (req) => {
  assertWritesAllowed(); // 503 during a backup; mutates nothing

  let parsed: z.infer<typeof putSchema>;
  try {
    parsed = putSchema.parse(await req.json());
  } catch {
    return jsonBadRequest('invalid_body');
  }

  try {
    const updated = updateCleanupSettings({
      dataDir,
      enabled: parsed.enabled,
      thresholdHours: parsed.thresholdHours
    });
    return Response.json(withLimits(updated));
  } catch (e) {
    if (e instanceof ThresholdValidationError) return jsonBadRequest('threshold_out_of_range');
    throw e;
  }
});
