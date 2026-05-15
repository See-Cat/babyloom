import { mkdirSync } from 'fs';

export function ensureUploadDir(path: string) {
  mkdirSync(path, { recursive: true });
}
