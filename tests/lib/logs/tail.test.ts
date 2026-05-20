import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tail } from '@/lib/logs/tail';

describe('tail', () => {
  it('returns the last N JSON lines from a short file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'babyloom-tail-'));
    const file = join(dir, 'app.log');
    writeFileSync(
      file,
      [
        JSON.stringify({ level: 30, msg: 'one' }),
        JSON.stringify({ level: 40, msg: 'two' }),
        JSON.stringify({ level: 50, msg: 'three' }),
        ''
      ].join('\n')
    );

    await expect(tail(file, 2)).resolves.toEqual([
      { level: 40, msg: 'two' },
      { level: 50, msg: 'three' }
    ]);
  });

  it('handles long files and skips malformed lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'babyloom-tail-'));
    const file = join(dir, 'app.log');
    const lines = Array.from({ length: 3000 }, (_, i) => JSON.stringify({ level: 30, msg: `line-${i}` }));
    lines.splice(2998, 0, 'not-json');
    writeFileSync(file, lines.join('\n'));

    const rows = await tail(file, 3);
    expect(rows.map((row) => row.msg)).toEqual(['line-2997', 'line-2998', 'line-2999']);
  });

  it('returns an empty array for a missing file', async () => {
    await expect(tail('/tmp/babyloom-missing-log-file', 200)).resolves.toEqual([]);
  });
});
