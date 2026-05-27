import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getAuth } from '@/lib/auth/server';
import { takeClientLogToken } from '@/lib/client/log/client-rate-limit';
import { createLogger } from '@/lib/log/server';

const payloadSchema = z.object({
  message: z.string().min(1).max(4000),
  stack: z.string().max(8000).optional(),
  url: z.string().url().optional(),
  userAgent: z.string().max(500).optional()
});

let cachedLogger: ReturnType<typeof createLogger> | null = null;
let cachedLoggerDataDir: string | null = null;

export const POST = async (req: Request) => {
  const body = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_client_log' }, { status: 400 });
  }

  const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');
  const session = await getAuth({ dataDir }).api.getSession({ headers: req.headers }).catch(() => null);
  const key = session?.user?.id ?? clientIp(req);

  if (!takeClientLogToken(key)) {
    return new NextResponse(null, { status: 429 });
  }

  logger(dataDir).error(
    {
      module: 'client',
      userId: session?.user?.id ?? null,
      stack: body.data.stack,
      url: body.data.url,
      userAgent: body.data.userAgent
    },
    body.data.message
  );

  return new NextResponse(null, { status: 204 });
};

function logger(dataDir: string) {
  if (!cachedLogger || cachedLoggerDataDir !== dataDir) {
    cachedLogger = createLogger({ dataDir, level: 'info' });
    cachedLoggerDataDir = dataDir;
  }
  return cachedLogger;
}

function clientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  );
}
