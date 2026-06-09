import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { appSettings } from '@/lib/server/db/schema';

// The single settings row uses a constant primary key — there is at most one.
const SETTINGS_ROW_ID = 'singleton';

export const MIN_THRESHOLD_HOURS = 6;
export const MAX_THRESHOLD_HOURS = 720;
export const DEFAULT_THRESHOLD_HOURS = 24;
export const DEFAULT_ENABLED = true;

export interface CleanupSettings {
  enabled: boolean;
  thresholdHours: number;
  lastRunAt: number | null;
  lastRunDeleted: number;
}

// Read with default fallback. An absent row means "enabled, 24h" so the worker
// never breaks on missing config (matches prior hardcoded behavior).
export function getCleanupSettings(opts: { dataDir: string }): CleanupSettings {
  const { db } = getDb({ dataDir: opts.dataDir });
  const row = db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ROW_ID)).get();
  if (!row) {
    return {
      enabled: DEFAULT_ENABLED,
      thresholdHours: DEFAULT_THRESHOLD_HOURS,
      lastRunAt: null,
      lastRunDeleted: 0
    };
  }
  return {
    enabled: row.mediaCleanupEnabled === 1,
    thresholdHours: row.mediaCleanupThresholdHours,
    lastRunAt: row.mediaCleanupLastRunAt,
    lastRunDeleted: row.mediaCleanupLastRunDeleted
  };
}

export class ThresholdValidationError extends Error {
  constructor(public readonly value: number) {
    super(
      `threshold must be between ${MIN_THRESHOLD_HOURS} and ${MAX_THRESHOLD_HOURS} hours, got ${value}`
    );
    this.name = 'ThresholdValidationError';
  }
}

function assertValidThreshold(thresholdHours: number): void {
  if (
    !Number.isInteger(thresholdHours) ||
    thresholdHours < MIN_THRESHOLD_HOURS ||
    thresholdHours > MAX_THRESHOLD_HOURS
  ) {
    throw new ThresholdValidationError(thresholdHours);
  }
}

// Owner config write. Validates the threshold, then upserts ONLY the columns
// the owner owns (enabled / threshold) via a single atomic, column-isolated
// upsert — never touching the run-stat columns. Creates the row with defaults
// on first write (see D9). Either writer may be the first on an upgraded DB.
export function updateCleanupSettings(opts: {
  dataDir: string;
  enabled?: boolean;
  thresholdHours?: number;
  nowMs?: number;
}): CleanupSettings {
  if (opts.thresholdHours !== undefined) assertValidThreshold(opts.thresholdHours);

  const now = opts.nowMs ?? Date.now();
  const { db } = getDb({ dataDir: opts.dataDir });

  const insertValues: typeof appSettings.$inferInsert = { id: SETTINGS_ROW_ID, updatedAt: now };
  const updateSet: Partial<typeof appSettings.$inferInsert> = { updatedAt: now };

  if (opts.enabled !== undefined) {
    insertValues.mediaCleanupEnabled = opts.enabled ? 1 : 0;
    updateSet.mediaCleanupEnabled = opts.enabled ? 1 : 0;
  }
  if (opts.thresholdHours !== undefined) {
    insertValues.mediaCleanupThresholdHours = opts.thresholdHours;
    updateSet.mediaCleanupThresholdHours = opts.thresholdHours;
  }

  db.insert(appSettings)
    .values(insertValues)
    .onConflictDoUpdate({ target: appSettings.id, set: updateSet })
    .run();

  return getCleanupSettings({ dataDir: opts.dataDir });
}

// Run-stat write. Upserts ONLY the run-stat columns; leaves enabled/threshold at
// their stored values (or defaults, on a fresh row) — column isolation (D9).
export function recordCleanupRun(opts: {
  dataDir: string;
  runAtMs: number;
  deletedCount: number;
}): void {
  const { db } = getDb({ dataDir: opts.dataDir });

  db.insert(appSettings)
    .values({
      id: SETTINGS_ROW_ID,
      mediaCleanupLastRunAt: opts.runAtMs,
      mediaCleanupLastRunDeleted: opts.deletedCount,
      updatedAt: opts.runAtMs
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        mediaCleanupLastRunAt: opts.runAtMs,
        mediaCleanupLastRunDeleted: opts.deletedCount,
        updatedAt: opts.runAtMs
      }
    })
    .run();
}
