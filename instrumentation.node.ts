import { resolve } from 'node:path';
import { loadConfig } from '@/lib/config/load';
import { createLogger } from '@/lib/log/server';
import { runMigrations } from '@/lib/db/migrate';
import { bootstrapOwner } from '@/lib/bootstrap/owner';

export async function startup() {
  const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

  const config = loadConfig({ dataDir });
  const log = createLogger({ dataDir, level: config.log.level }).child({ module: 'startup' });

  log.info({ dataDir }, 'starting babyloom');

  runMigrations(dataDir);
  log.info('migrations applied');

  await bootstrapOwner({ dataDir });
  log.info({ owner: config.owner.username }, 'owner ensured');

  log.info('startup complete');
}
