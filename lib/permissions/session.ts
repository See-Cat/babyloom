import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { UnauthorizedError } from './errors';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export async function getSessionUserId(req: Request): Promise<string> {
  if (!req.headers.get('cookie')) {
    throw new UnauthorizedError();
  }
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}

// Variant for server actions / RSC where `headers()` is the source.
export async function getSessionUserIdFromHeaders(
  headers: Headers | Promise<Headers>
): Promise<string> {
  const auth = getAuth({ dataDir });
  const h = headers instanceof Headers ? headers : await headers;
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}
