import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');
const auth = getAuth({ dataDir });

export const GET = auth.handler;
export const POST = auth.handler;
