import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from 'pino';

export interface PruneOldLogsOptions {
  logsDir: string;
  keepDays?: number;
  log?: Logger;
}

export interface PruneOldLogsSummary {
  deleted: number;
  failed: number;
}

const APP_LOG_RE = /^app-\d{4}-\d{2}-\d{2}\.log$/;

export async function pruneOldLogs(opts: PruneOldLogsOptions): Promise<PruneOldLogsSummary> {
  const keepDays = opts.keepDays ?? 30;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let failed = 0;

  let files: string[];
  try {
    files = await readdir(opts.logsDir);
  } catch (err) {
    opts.log?.warn({ err, logsDir: opts.logsDir }, 'log prune skipped');
    return { deleted, failed: 1 };
  }

  for (const file of files) {
    if (!APP_LOG_RE.test(file)) continue;
    const path = join(opts.logsDir, file);
    try {
      const info = await stat(path);
      if (info.mtimeMs >= cutoff) continue;
      await unlink(path);
      deleted += 1;
    } catch (err) {
      failed += 1;
      opts.log?.warn({ err, file }, 'failed to prune log file');
    }
  }

  opts.log?.info({ deleted, failed }, 'log prune complete');
  return { deleted, failed };
}
