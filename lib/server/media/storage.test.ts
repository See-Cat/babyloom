import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { finalRelativePath } from '@/lib/server/media/paths';
import { commitStaging, prepareStaging, purgeFinalDir, purgeStagingDir } from '@/lib/server/media/storage';

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'storage-'));
});

describe('storage', () => {
  test('prepareStaging creates the upload dir', async () => {
    const staging = await prepareStaging(dataDir, 'upl-1');
    expect(existsSync(staging.stagingDir)).toBe(true);
    expect(staging.rawPath.endsWith('raw.bin')).toBe(true);
  });

  test('commitStaging atomically promotes photo variants', async () => {
    const staging = await prepareStaging(dataDir, 'm-1');
    writeFileSync(join(staging.stagingDir, 'original.jpg'), 'a');
    writeFileSync(join(staging.stagingDir, 'large.webp'), 'b');
    writeFileSync(join(staging.stagingDir, 'thumb.webp'), 'c');

    const ts = Date.UTC(2026, 4, 17);
    const rel = await commitStaging(dataDir, {
      mediaId: 'm-1',
      babyId: 'b-1',
      createdAtMs: ts,
      ext: 'jpg',
      kind: 'photo'
    });

    expect(rel).toBe(finalRelativePath('b-1', ts, 'm-1'));
    expect(existsSync(join(dataDir, rel, 'original.jpg'))).toBe(true);
    expect(existsSync(join(dataDir, rel, 'large.webp'))).toBe(true);
    expect(existsSync(join(dataDir, rel, 'thumb.webp'))).toBe(true);
    expect(existsSync(staging.stagingDir)).toBe(false);
  });

  test('commitStaging includes poster for video kind', async () => {
    const staging = await prepareStaging(dataDir, 'm-2');
    writeFileSync(join(staging.stagingDir, 'original.mp4'), 'a');
    writeFileSync(join(staging.stagingDir, 'poster.webp'), 'p');
    const rel = await commitStaging(dataDir, {
      mediaId: 'm-2',
      babyId: 'b-1',
      createdAtMs: Date.UTC(2026, 4, 17),
      ext: 'mp4',
      kind: 'video'
    });
    expect(existsSync(join(dataDir, rel, 'poster.webp'))).toBe(true);
  });

  test('purgeStagingDir removes everything', async () => {
    const staging = await prepareStaging(dataDir, 'm-3');
    writeFileSync(join(staging.stagingDir, 'raw.bin'), 'x');
    await purgeStagingDir(staging.stagingDir);
    expect(existsSync(staging.stagingDir)).toBe(false);
  });

  test('purgeFinalDir refuses to escape data/media root', async () => {
    await expect(purgeFinalDir(dataDir, '../escape')).rejects.toThrow();
  });
});
