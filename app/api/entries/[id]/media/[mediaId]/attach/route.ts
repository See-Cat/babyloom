// eslint-route-auth: manual
import { and, eq, ne } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { getDb } from '@/lib/server/db/client';
import { entryMedia, media } from '@/lib/server/db/schema';
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError
} from '@/lib/server/permissions/errors';
import {
  jsonNotFound,
  jsonServiceUnavailable,
  jsonUnauthorized,
  UUID_RE
} from '@/lib/server/permissions/responses';
import { getSessionUserId } from '@/lib/server/permissions/session';
import { loadAndAssertTarget } from '@/lib/server/permissions/target-loaders';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

interface Ctx {
  params: Promise<{ id: string; mediaId: string }>;
}

async function handle(req: NextRequest, ctx: Ctx, op: 'attach' | 'detach'): Promise<Response> {
  try {
    assertWritesAllowed();
  } catch (e) {
    if (e instanceof ServiceUnavailableError) {
      return jsonServiceUnavailable(e.detail, e.retryAfterSeconds);
    }
    throw e;
  }

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
      // Attach may need to rescue a draft the orphan-cleanup backstop trashed
      // while the composer was still open (see the rescue branch below), so it
      // also loads 'trashed' rows; detach stays strict.
      allowedStatuses: op === 'attach' ? ['ready', 'trashed'] : ['ready'],
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
    const now = Date.now();
    // Decide eligibility and write atomically from CURRENT db state, not the
    // pre-load snapshot: the orphan-cleanup worker (reconcile.ts) may have
    // trashed this media in the window between load and write. Re-reading inside
    // the transaction keeps attach correct under that race instead of returning
    // success while leaving the media trashed.
    //
    // Two write modes:
    //  - Promote: a still-ready upload "graduates" into a permanent gallery photo
    //    (origin 'entry_draft' -> 'standalone'), so a LATER detach — which keeps
    //    the photo in the gallery by design — can't match the cleanup backstop.
    //  - Rescue: the backstop already trashed a still-live draft; an explicit
    //    attach restores it. Scoped tightly to media THIS user uploaded that the
    //    SYSTEM trashed (deletedBy IS NULL), so a user-trashed photo is never
    //    silently resurrected. If the SAME bytes were meanwhile re-uploaded as a
    //    ready row, restoring this draft would collide with the partial unique
    //    index (babyId, contentHash WHERE status='ready'), so attach that ready
    //    row instead and leave the trashed draft alone.
    const outcome = db.transaction((tx) => {
      const cur =
        // PARENT-CHAIN-EXEMPT: by-primary-key re-read of the already-loaded media; tenant scoping + permission were asserted by loadAndAssertTarget above.
        tx
        .select({
          status: media.status,
          origin: media.origin,
          deletedBy: media.deletedBy,
          uploadedBy: media.uploadedBy,
          babyId: media.babyId,
          contentHash: media.contentHash
        })
        .from(media)
        .where(eq(media.id, mediaRow.id))
        .get();
      if (!cur) return 'gone' as const;

      const isRescue =
        cur.status === 'trashed' &&
        cur.origin === 'entry_draft' &&
        cur.deletedBy == null &&
        cur.uploadedBy === userId;
      if (cur.status !== 'ready' && !isRescue) return 'gone' as const;

      // Prefer an already-ready row with the same content over resurrecting the
      // trashed draft — both avoids the unique-index conflict and matches the
      // upload pipeline's dedupe semantics ("the content already exists, use it").
      let targetId = mediaRow.id;
      let restore = isRescue;
      if (isRescue && cur.contentHash != null) {
        const readyDup =
          // PARENT-CHAIN-EXEMPT: dedupe lookup scoped to the already-authorized media's babyId.
          tx
          .select({ id: media.id })
          .from(media)
          .where(
            and(
              eq(media.babyId, cur.babyId),
              eq(media.contentHash, cur.contentHash),
              eq(media.status, 'ready'),
              ne(media.id, mediaRow.id)
            )
          )
          .get();
        if (readyDup) {
          targetId = readyDup.id;
          restore = false; // attach the existing ready dup; keep the draft trashed
        }
      }

      const existing = tx
        .select({ entryId: entryMedia.entryId })
        .from(entryMedia)
        .where(and(eq(entryMedia.entryId, entry.id), eq(entryMedia.mediaId, targetId)))
        .get();
      if (!existing) {
        tx.insert(entryMedia)
          .values({ entryId: entry.id, mediaId: targetId, attachedBy: userId, attachedAt: now })
          .run();
      }
      if (restore) {
        tx.update(media)
          .set({ status: 'ready', deletedAt: null, deletedBy: null, origin: 'standalone', updatedAt: now })
          .where(eq(media.id, targetId))
          .run();
      } else {
        tx.update(media)
          .set({ origin: 'standalone', updatedAt: now })
          .where(and(eq(media.id, targetId), eq(media.origin, 'entry_draft')))
          .run();
      }
      return { alreadyExisted: Boolean(existing) } as const;
    });

    if (outcome === 'gone') return jsonNotFound();
    return Response.json({ attached: true, alreadyExisted: outcome.alreadyExisted });
  }

  db.delete(entryMedia)
    .where(and(eq(entryMedia.entryId, entry.id), eq(entryMedia.mediaId, mediaRow.id)))
    .run();
  return Response.json({ detached: true });
}

export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'attach');
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'detach');
