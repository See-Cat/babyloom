import pino, { type Logger } from 'pino';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
  'apiKey',
  '*.apiKey'
];

export function createLogger(opts: LoggerOptions): Logger {
  const logsDir = join(opts.dataDir, 'logs');
  mkdirSync(logsDir, { recursive: true });

  return pino({
    level: opts.level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]'
    },
    transport: {
      targets: [
        {
          target: 'pino/file',
          level: opts.level,
          options: { destination: 1 }
        },
        {
          target: 'pino-roll',
          level: opts.level,
          options: {
            file: join(logsDir, 'app'),
            frequency: 'daily',
            extension: '.log',
            mkdir: true
          }
        }
      ]
    }
  });
}
