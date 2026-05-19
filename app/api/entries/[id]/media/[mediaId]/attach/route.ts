// eslint-route-auth: manual
import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { entryMedia } from '@/lib/db/schema';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/permissions/errors';
import { jsonNotFound, jsonUnauthorized, UUID_RE } from '@/lib/permissions/responses';
import { getSessionUserId } from '@/lib/permissions/session';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

interface Ctx {
  params: Promise<{ id: string; mediaId: string }>;
}

async function handle(req: NextRequest, ctx: Ctx, op: 'attach' | 'detach'): Promise<Response> {
  let userId: string;
  try {
    userId = await getSessionUserId(req);
  } catch (e) {
    if (e instanceof UnauthorizedError) return jsonUnauthorized();
    throw e;
  }

  const params = await ctx.params;
  if (!UUID_RE.test(params.id) || !UUID_RE.test(params.mediaId)) return jsonNotFound();

  let mediaRow: any;
  let entry: any;
  try {
    mediaRow = await loadAndAssertTarget({
      id: params.mediaId,
      table: 'media',
      allowedStatuses: ['ready'],
      requirePermission: { userId, action: 'media:read' },
      dataDir
    });
    entry = await loadAndAssertTarget({
      id: params.id,
      table: 'entries',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'entry:write' },
      dataDir
    });
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
    throw e;
  }

  if (entry.babyId !== mediaRow.babyId) return jsonNotFound();

  const { db } = getDb({ dataDir });
  if (op === 'attach') {
    const existing = db
      .select({ entryId: entryMedia.entryId })
      .from(entryMedia)
      .where(and(eq(entryMedia.entryId, entry.id), eq(entryMedia.mediaId, mediaRow.id)))
      .get();
    if (existing) return Response.json({ attached: true, alreadyExisted: true });
    db.insert(entryMedia)
      .values({ entryId: entry.id, mediaId: mediaRow.id, attachedBy: userId, attachedAt: Date.now() })
      .run();
    return Response.json({ attached: true, alreadyExisted: false });
  }

  db.delete(entryMedia)
    .where(and(eq(entryMedia.entryId, entry.id), eq(entryMedia.mediaId, mediaRow.id)))
    .run();
  return Response.json({ detached: true });
}

export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'attach');
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'detach');
