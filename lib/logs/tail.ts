import { open } from 'node:fs/promises';

export interface LogRow {
  time?: number;
  level?: number | string;
  module?: string;
  msg?: string;
  [key: string]: unknown;
}

export async function tail(filePath: string, n: number): Promise<LogRow[]> {
  if (n <= 0) return [];

  let file;
  try {
    file = await open(filePath, 'r');
  } catch (e: any) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }

  try {
    const stat = await file.stat();
    const chunks: Buffer[] = [];
    const chunkSize = 64 * 1024;
    let pos = stat.size;
    let newlineCount = 0;

    while (pos > 0 && newlineCount <= n) {
      const size = Math.min(chunkSize, pos);
      pos -= size;
      const buf = Buffer.alloc(size);
      await file.read(buf, 0, size, pos);
      chunks.unshift(buf);
      for (const byte of buf) if (byte === 10) newlineCount += 1;
    }

    return Buffer.concat(chunks)
      .toString('utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as LogRow];
        } catch {
          return [];
        }
      })
      .slice(-n);
  } finally {
    await file.close();
  }
}
