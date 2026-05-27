import { join, resolve } from 'node:path';
import { loadConfig } from '@/lib/server/config/load';
import { createLogger } from '@/lib/server/log/server';
import { pruneOldLogs } from '@/lib/server/log/prune';
import { runMigrations } from '@/lib/server/db/migrate';
import { bootstrapOwner } from '@/lib/server/bootstrap/owner';
import { startReconcileWorker } from '@/lib/server/media/reconcile';

let startupPromise: Promise<void> | null = null;

export async function startup() {
  const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');

  const config = loadConfig({ dataDir });
  const log = createLogger({ dataDir, level: config.log.level }).child({ module: 'startup' });
  const logsDir = join(dataDir, 'logs');

  log.info({ dataDir }, 'starting babyloom');
  await pruneOldLogs({ logsDir, log });
  scheduleLogPrune(logsDir, log);

  runMigrations(dataDir);
  log.info('migrations applied');

  await bootstrapOwner({ dataDir });
  log.info({ owner: config.owner.username }, 'owner ensured');

  if (process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE !== '1') {
    startReconcileWorker(dataDir);
    log.info('media reconcile worker started');
  }

  log.info('startup complete');
}

export function ensureStartup() {
  startupPromise ??= startup();
  return startupPromise;
}

let pruneTimer: ReturnType<typeof setInterval> | null = null;

function scheduleLogPrune(logsDir: string, log: ReturnType<typeof createLogger>) {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    pruneOldLogs({ logsDir, log }).catch((err) => log.warn({ err }, 'scheduled log prune failed'));
  }, 24 * 60 * 60 * 1000);
  pruneTimer.unref?.();
}
