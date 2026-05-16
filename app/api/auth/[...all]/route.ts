import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { ensureStartup } from '@/instrumentation.node';

const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');

async function handle(req: Request) {
  await ensureStartup();
  return getAuth({ dataDir }).handler(req);
}

export const GET = handle;
export const POST = handle;
