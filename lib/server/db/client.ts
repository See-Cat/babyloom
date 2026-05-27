import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema';

export interface GetDbOptions {
  dataDir: string;
}

interface DbHandle {
  db: BetterSQLite3Database<typeof schema>;
  raw: Database.Database;
}

let cached: { dataDir: string; handle: DbHandle } | null = null;

export function getDb(opts: GetDbOptions): DbHandle {
  if (cached && cached.dataDir === opts.dataDir) return cached.handle;

  const dbDir = join(opts.dataDir, 'db');
  mkdirSync(dbDir, { recursive: true });
  const file = join(dbDir, 'babyloom.sqlite');

  const raw = new Database(file);
  // §14 PRAGMAs — applied immediately after open
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');
  raw.pragma('temp_store = MEMORY');

  const db = drizzle(raw, { schema });
  const handle = { db, raw };
  cached = { dataDir: opts.dataDir, handle };
  return handle;
}

// Test-only: forget the cached instance so a fresh tempdir test gets a fresh DB
export function resetDbForTesting() {
  if (cached) {
    cached.handle.raw.close();
    cached = null;
  }
}
