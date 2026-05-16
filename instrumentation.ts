import { resolve } from 'node:path';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

  const { loadConfig } = await import('@/lib/config/load');
  const { createLogger } = await import('@/lib/log/server');
  const { runMigrations } = await import('@/lib/db/migrate');
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');

  const config = loadConfig({ dataDir });
  const log = createLogger({ dataDir, level: config.log.level }).child({ module: 'startup' });

  log.info({ dataDir }, 'starting babyloom');

  runMigrations(dataDir);
  log.info('migrations applied');

  await bootstrapOwner({ dataDir });
  log.info({ owner: config.owner.username }, 'owner ensured');

  log.info('startup complete');
}
