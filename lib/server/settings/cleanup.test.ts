import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resetDbForTesting } from '@/lib/server/db/client';
import { runMigrations } from '@/lib/server/db/migrate';
import {
  DEFAULT_THRESHOLD_HOURS,
  MAX_THRESHOLD_HOURS,
  MIN_THRESHOLD_HOURS,
  getCleanupSettings,
  recordCleanupRun,
  updateCleanupSettings
} from '@/lib/server/settings/cleanup';

let dataDir: string;

beforeEach(() => {
  resetDbForTesting();
  dataDir = mkdtempSync(join(tmpdir(), 'cleanup-settings-'));
  runMigrations(dataDir);
});

afterEach(() => {
  resetDbForTesting();
});

describe('getCleanupSettings', () => {
  test('returns safe defaults when the row is absent', () => {
    const settings = getCleanupSettings({ dataDir });
    expect(settings.enabled).toBe(true);
    expect(settings.thresholdHours).toBe(DEFAULT_THRESHOLD_HOURS);
    expect(settings.lastRunAt).toBeNull();
    expect(settings.lastRunDeleted).toBe(0);
  });

  test('returns stored values when present', () => {
    updateCleanupSettings({ dataDir, enabled: false, thresholdHours: 72, nowMs: 1000 });
    const settings = getCleanupSettings({ dataDir });
    expect(settings.enabled).toBe(false);
    expect(settings.thresholdHours).toBe(72);
  });
});

describe('updateCleanupSettings', () => {
  test('rejects a threshold below the minimum and leaves the stored value unchanged', () => {
    updateCleanupSettings({ dataDir, thresholdHours: 48, nowMs: 1 });
    expect(() => updateCleanupSettings({ dataDir, thresholdHours: MIN_THRESHOLD_HOURS - 1, nowMs: 2 })).toThrow();
    expect(getCleanupSettings({ dataDir }).thresholdHours).toBe(48);
  });

  test('rejects a threshold above the maximum and leaves the stored value unchanged', () => {
    updateCleanupSettings({ dataDir, thresholdHours: 48, nowMs: 1 });
    expect(() => updateCleanupSettings({ dataDir, thresholdHours: MAX_THRESHOLD_HOURS + 1, nowMs: 2 })).toThrow();
    expect(getCleanupSettings({ dataDir }).thresholdHours).toBe(48);
  });

  test('accepts in-range values and toggles enabled', () => {
    updateCleanupSettings({ dataDir, enabled: false, thresholdHours: MIN_THRESHOLD_HOURS, nowMs: 1 });
    let s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(false);
    expect(s.thresholdHours).toBe(MIN_THRESHOLD_HOURS);

    updateCleanupSettings({ dataDir, enabled: true, thresholdHours: MAX_THRESHOLD_HOURS, nowMs: 2 });
    s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(true);
    expect(s.thresholdHours).toBe(MAX_THRESHOLD_HOURS);
  });

  test('creates the row on first write without throwing', () => {
    expect(() => updateCleanupSettings({ dataDir, enabled: false, nowMs: 1 })).not.toThrow();
    expect(getCleanupSettings({ dataDir }).enabled).toBe(false);
  });
});

describe('recordCleanupRun', () => {
  test('persists lastRunAt + deletedCount and reads them back', () => {
    recordCleanupRun({ dataDir, runAtMs: 12345, deletedCount: 3 });
    const s = getCleanupSettings({ dataDir });
    expect(s.lastRunAt).toBe(12345);
    expect(s.lastRunDeleted).toBe(3);
  });

  test('recording on an absent row succeeds and leaves enabled/threshold at defaults', () => {
    expect(() => recordCleanupRun({ dataDir, runAtMs: 999, deletedCount: 7 })).not.toThrow();
    const s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(true);
    expect(s.thresholdHours).toBe(DEFAULT_THRESHOLD_HOURS);
    expect(s.lastRunAt).toBe(999);
    expect(s.lastRunDeleted).toBe(7);
  });
});

describe('column isolation (no clobber)', () => {
  test('a later stat write preserves the owner-set enabled/threshold', () => {
    updateCleanupSettings({ dataDir, enabled: false, thresholdHours: 72, nowMs: 1 });
    recordCleanupRun({ dataDir, runAtMs: 5000, deletedCount: 2 });
    const s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(false);
    expect(s.thresholdHours).toBe(72);
    expect(s.lastRunAt).toBe(5000);
    expect(s.lastRunDeleted).toBe(2);
  });

  test('a later owner change preserves recorded run stats', () => {
    recordCleanupRun({ dataDir, runAtMs: 5000, deletedCount: 2 });
    updateCleanupSettings({ dataDir, thresholdHours: 100, nowMs: 6000 });
    const s = getCleanupSettings({ dataDir });
    expect(s.lastRunAt).toBe(5000);
    expect(s.lastRunDeleted).toBe(2);
    expect(s.thresholdHours).toBe(100);
  });

  test('the stat writer may be the first writer on a fresh DB', () => {
    recordCleanupRun({ dataDir, runAtMs: 1, deletedCount: 0 });
    updateCleanupSettings({ dataDir, enabled: false, nowMs: 2 });
    const s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(false);
    expect(s.thresholdHours).toBe(DEFAULT_THRESHOLD_HOURS);
    expect(s.lastRunAt).toBe(1);
  });
});
