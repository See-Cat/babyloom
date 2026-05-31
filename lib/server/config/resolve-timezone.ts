import { resolve } from 'node:path';
import { loadConfig } from './load';

const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// Resolve the app timezone for the root layout, which feeds every client component
// that formats timestamps/age. The timezone is validated in the config schema, so
// a value read here is always a usable IANA zone.
//
// Fall back ONLY when config.yaml is genuinely absent (build-time introspection —
// the app opts out of static prerendering). A malformed config (e.g. an invalid
// app.timezone) must fail loudly and consistently with the API routes and startup
// bootstrap rather than silently rendering data under the wrong zone, so rethrow it.
export function resolveTimezone(): string {
  const dataDir = process.env.BABYLOOM_DATA_DIR
    ? resolve(process.env.BABYLOOM_DATA_DIR)
    : resolve(process.cwd(), 'data');
  try {
    return loadConfig({ dataDir }).app.timezone;
  } catch (err) {
    if (err instanceof Error && err.message.includes('config.yaml not found')) {
      return DEFAULT_TIMEZONE;
    }
    throw err;
  }
}
