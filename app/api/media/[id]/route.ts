import { eq } from 'drizzle-orm';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { assertWritesAllowed } from '@/lib/backup/write-barrier';
import { getDb } from '@/lib/db/client';
import { babies, media } from '@/lib/db/schema';
import { OutputBadRequestError, resolveOutputVariant } from '@/lib/media/output';
import { resolveVariantPath } from '@/lib/media/paths';
import { jsonBadRequest } from '@/lib/permissions/responses';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { purgeMedia } from '@/lib/trash/purge';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMediaForRead(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: media.id,
      babyId: media.babyId,
      uploadedBy: media.uploadedBy,
      status: media.status,
      type: media.type,
      mimeType: media.mimeType,
      relativePath: media.relativePath,
      originalExt: media.originalExt,
      filename: media.filename,
      babyStatus: babies.status
    })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .where(eq(media.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

async function loadMediaForPurge(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: media.id,
      babyId: media.babyId,
      uploadedBy: media.uploadedBy,
      status: media.status,
      relativePath: media.relativePath,
      babyStatus: babies.status
    })
    .from(media)
    .innerJoin(babies, eq(babies.id, media.babyId))
    .where(eq(media.id, id))
    .get();
  if (!row) return null;
  if (row.babyStatus !== 'active' && row.babyStatus !== 'trashed') return null;
  return row;
}

export const GET = withAuthorizedResource({
  action: 'media:read',
  loader: loadMediaForRead,
  getStatus: (row) => row.status,
  // 'trashed' is allowed so the trash UI can render thumbnails for items
  // soft-deleted but not yet purged. Authorization is still enforced.
  allowedStatuses: ['ready', 'trashed'],
  toResource: (row) => ({ babyId: row.babyId, mediaId: row.id, uploadedBy: row.uploadedBy })
})(async (req, _ctx, row) => {
  let desc;
  try {
    desc = resolveOutputVariant(
      {
        id: row.id,
        type: row.type as 'photo' | 'video',
        mimeType: row.mimeType!,
        originalExt: row.originalExt!,
        filename: row.filename
      },
      new URL(req.url).searchParams.get('size') ?? 'large'
    );
  } catch (e) {
    if (e instanceof OutputBadRequestError) return jsonBadRequest('bad_size');
    throw e;
  }

  const abs = resolveVariantPath(dataDir, row.relativePath!, desc.variant, row.originalExt!);
  const st = await stat(abs).catch(() => null);
  if (!st) return new Response(null, { status: 404 });

  const headers: Record<string, string> = {
    'content-type': desc.contentType,
    'content-disposition': desc.contentDisposition,
    'content-length': String(st.size),
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'cache-control': 'private, max-age=31536000, immutable',
    'accept-ranges': 'bytes'
  };

  const range = req.headers.get('range');
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), st.size - 1) : st.size - 1;
      if (start <= end && end < st.size) {
        headers['content-length'] = String(end - start + 1);
        headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
        return new Response(Readable.toWeb(createReadStream(abs, { start, end })) as any, {
          status: 206,
          headers
        });
      }
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
    }
  }

  return new Response(Readable.toWeb(createReadStream(abs)) as any, { status: 200, headers });
});

export const DELETE = withAuthorizedResource({
  action: 'media:purge',
  loader: loadMediaForPurge,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({ babyId: row.babyId, mediaId: row.id, uploadedBy: row.uploadedBy })
})(async (_req, _ctx, row) => {
  assertWritesAllowed();

  await purgeMedia(dataDir, row.id, row.relativePath);
  return Response.json({ purged: row.id });
});
