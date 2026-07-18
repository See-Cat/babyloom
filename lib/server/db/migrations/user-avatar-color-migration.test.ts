import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getDb, resetDbForTesting } from '@/lib/server/db/client';
import { runMigrations } from '@/lib/server/db/migrate';

let dataDir: string;

beforeEach(() => {
  resetDbForTesting();
  dataDir = mkdtempSync(join(tmpdir(), 'user-avatar-color-mig-'));
  runMigrations(dataDir);
});

afterEach(() => {
  resetDbForTesting();
});

describe('0006_user_avatar_color migration', () => {
  test('adds avatar_color to the user table', () => {
    const { raw } = getDb({ dataDir });
    const columns = raw.prepare('PRAGMA table_info(user)').all() as { name: string }[];

    expect(columns.some((column) => column.name === 'avatar_color')).toBe(true);
  });
});
