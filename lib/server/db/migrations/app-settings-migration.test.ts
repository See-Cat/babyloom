import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getDb, resetDbForTesting } from '@/lib/server/db/client';
import { runMigrations } from '@/lib/server/db/migrate';

let dataDir: string;

beforeEach(() => {
  resetDbForTesting();
  dataDir = mkdtempSync(join(tmpdir(), 'app-settings-mig-'));
  runMigrations(dataDir);
});

afterEach(() => {
  resetDbForTesting();
});

describe('0005_app_settings migration', () => {
  test('creates the app_settings table (fails loudly if the journal entry is missing)', () => {
    const { raw } = getDb({ dataDir });
    const row = raw
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'`)
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('app_settings');
  });
});
