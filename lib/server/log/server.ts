import pino, { type Logger } from 'pino';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';

export interface LoggerOptions {
  dataDir: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'passwordHash',
  '*.passwordHash',
  'apiKey',
  '*.apiKey'
];

function todayLogFile(logsDir: string): string {
  return join(logsDir, `app-${new Date().toISOString().slice(0, 10)}.log`);
}

function createDailyFileStream(logsDir: string): Writable {
  let currentPath = '';
  let stream: WriteStream | null = null;

  return new Writable({
    write(chunk, _encoding, callback) {
      const nextPath = todayLogFile(logsDir);
      if (nextPath !== currentPath) {
        stream?.end();
        currentPath = nextPath;
        stream = createWriteStream(currentPath, { flags: 'a' });
      }
      stream!.write(chunk, callback);
    },
    final(callback) {
      if (!stream) {
        callback();
        return;
      }
      stream.end(callback);
    }
  });
}

export function createLogger(opts: LoggerOptions): Logger {
  const logsDir = join(opts.dataDir, 'logs');
  mkdirSync(logsDir, { recursive: true });

  return pino(
    {
      level: opts.level,
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]'
      }
    },
    pino.multistream([{ stream: process.stdout }, { stream: createDailyFileStream(logsDir) }])
  );
}
