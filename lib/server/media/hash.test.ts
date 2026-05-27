import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, test } from 'vitest';
import { pipeThroughHasher } from '@/lib/server/media/hash';

describe('pipeThroughHasher', () => {
  test('reports server-authoritative sha256 + bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hash-'));
    const file = join(dir, 'a.bin');
    const bytes = Buffer.from('hello world');
    writeFileSync(file, bytes);

    const src = createReadStream(file);
    const sink = new PassThrough();
    const drain = new Promise<void>((resolve) => {
      sink.on('data', () => {});
      sink.on('end', () => resolve());
    });
    const result = await pipeThroughHasher(src, sink, { maxBytes: 1024 });
    await drain;

    expect(result.hash).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(result.bytes).toBe(bytes.length);
  });

  test('aborts when maxBytes is exceeded', async () => {
    const src = new PassThrough();
    const sink = new PassThrough();
    sink.on('data', () => {});
    const promise = pipeThroughHasher(src, sink, { maxBytes: 4 });
    src.write(Buffer.from('aaaaaaaa'));
    src.end();
    await expect(promise).rejects.toMatchObject({ code: 'too_large' });
  });
});
