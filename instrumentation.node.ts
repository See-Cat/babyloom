import { resolve } from 'node:path';
import { loadConfig } from '@/lib/config/load';
import { createLogger } from '@/lib/log/server';
import { runMigrations } from '@/lib/db/migrate';
import { bootstrapOwner } from '@/lib/bootstrap/owner';
import { startReconcileWorker } from '@/lib/media/reconcile';

let startupPromise: Promise<void> | null = null;

export async function startup() {
  const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');

  const config = loadConfig({ dataDir });
  const log = createLogger({ dataDir, level: config.log.level }).child({ module: 'startup' });

  log.info({ dataDir }, 'starting babyloom');

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
