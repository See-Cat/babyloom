import { beforeEach, describe, expect, it } from 'vitest';
import { closeSync, existsSync, mkdtempSync, openSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('pruneOldLogs', () => {
  let logsDir: string;

  beforeEach(() => {
    logsDir = mkdtempSync(join(tmpdir(), 'babyloom-prune-'));
  });

  it('deletes app log files older than the retention window', async () => {
    const oldFile = touchLog('app-2026-01-01.log', 40);
    const recentFile = touchLog('app-2026-02-01.log', 2);
    const unrelatedFile = touchLog('debug-2026-01-01.log', 40);

    const { pruneOldLogs } = await import('@/lib/log/prune');
    const summary = await pruneOldLogs({ logsDir, keepDays: 30 });

    expect(summary.deleted).toBe(1);
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(recentFile)).toBe(true);
    expect(existsSync(unrelatedFile)).toBe(true);
  });

  function touchLog(name: string, ageDays: number) {
    const file = join(logsDir, name);
    closeSync(openSync(file, 'w'));
    const time = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    utimesSync(file, time, time);
    return file;
  }
});
