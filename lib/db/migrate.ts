import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb } from './client';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function runMigrations(dataDir: string) {
  const { db } = getDb({ dataDir });
  migrate(db, { migrationsFolder: resolve(__dirname, 'migrations') });
}

// CLI entrypoint
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');
  runMigrations(dataDir);
  console.log(`Migrations applied at ${dataDir}/db/babyloom.sqlite`);
}
