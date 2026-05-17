import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';

export interface HashResult {
  hash: string;
  bytes: number;
}

export class MediaTooLargeError extends Error {
  code = 'too_large' as const;
}

export async function pipeThroughHasher(
  src: Readable,
  sink: Writable,
  opts: { maxBytes: number }
): Promise<HashResult> {
  const hasher = createHash('sha256');
  let bytes = 0;
  let settled = false;

  return await new Promise<HashResult>((resolve, reject) => {
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      src.destroy();
      sink.destroy();
      reject(e);
    };

    src.on('error', fail);
    sink.on('error', fail);
    sink.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve({ hash: hasher.digest('hex'), bytes });
    });
    sink.on('drain', () => src.resume());
    src.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > opts.maxBytes) {
        fail(new MediaTooLargeError('too_large'));
        return;
      }
      hasher.update(chunk);
      if (!sink.write(chunk)) src.pause();
    });
    src.on('end', () => sink.end());
  });
}
