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
  'passwordHash',
  '*.passwordHash',
  'apiKey',
  '*.apiKey'
];

function todayLogFile(logsDir: string): string {
  return join(logsDir, `app-${new Date().toISOString().slice(0, 10)}.log`);
}

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
          target: 'pino/file',
          level: opts.level,
          options: {
            destination: todayLogFile(logsDir),
            mkdir: true
          }
        }
      ]
    }
  });
}
