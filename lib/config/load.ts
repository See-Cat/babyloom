import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { configSchema, type Config } from './schema';

export interface LoadConfigOptions {
  dataDir: string;
}

let cached: { dataDir: string; config: Config } | null = null;

export function loadConfig(opts: LoadConfigOptions): Config {
  if (cached && cached.dataDir === opts.dataDir) return cached.config;

  const path = join(opts.dataDir, 'config.yaml');
  if (!existsSync(path)) {
    throw new Error(`config.yaml not found at ${path}`);
  }

  const raw = readFileSync(path, 'utf-8');
  const parsed = yaml.load(raw);
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid config.yaml: ${issues}`);
  }

  cached = { dataDir: opts.dataDir, config: result.data };
  return result.data;
}

export function clearConfigCache() {
  cached = null;
}
