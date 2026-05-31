import formidable from 'formidable';
import { mkdir } from 'fs/promises';
import { IncomingMessage } from 'node:http';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { runUploadPipeline, UploadValidationError } from '@/lib/server/media/upload-pipeline';
import { withAuthorizedAction } from '@/lib/server/permissions/action-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/server/permissions/responses';
import { loadAndAssertTarget } from '@/lib/server/permissions/target-loaders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export const POST = withAuthorizedAction({ action: 'media:write' })(async (req, userId) => {
  assertWritesAllowed();

  let parsed: ParsedMultipart;
  try {
    parsed = await parseMultipart(req);
  } catch {
    return jsonBadRequest('invalid_multipart');
  }

  if (!parsed.babyId || !UUID_RE.test(parsed.babyId)) return jsonBadRequest('babyId_required');
  if (!parsed.clientUploadId || parsed.clientUploadId.length < 8 || parsed.clientUploadId.length > 100) {
    return jsonBadRequest('clientUploadId_required');
  }
  if (parsed.entryId && !UUID_RE.test(parsed.entryId)) return jsonNotFound();
  if (!parsed.file) return jsonBadRequest('file_required');

  let baby: any;
  try {
    baby = await loadAndAssertTarget({
      id: parsed.babyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'media:write' },
      dataDir
    });
  } catch {
    return jsonNotFound();
  }

  let entry: any = null;
  if (parsed.entryId) {
    try {
      entry = await loadAndAssertTarget({
        id: parsed.entryId,
        table: 'entries',
        allowedStatuses: ['active'],
        requirePermission: { userId, action: 'entry:write' },
        dataDir
      });
    } catch {
      return jsonNotFound();
    }
    if (entry.babyId !== baby.id) return jsonNotFound();
  }

  try {
    const outcome = await runUploadPipeline({
      dataDir,
      userId,
      babyId: baby.id,
      entryId: entry?.id ?? null,
      clientUploadId: parsed.clientUploadId,
      filenameRaw: parsed.file.originalFilename || 'upload',
      uploadedFilePath: parsed.file.filepath
    });

    switch (outcome.kind) {
      case 'retry':
        return Response.json(
          { mediaId: outcome.mediaId, status: outcome.status, pollUrl: outcome.pollUrl },
          { status: 202 }
        );
      case 'ready_idempotent':
        return Response.json({ mediaId: outcome.mediaId, deduplicated: false });
      case 'deduped':
        return Response.json({ mediaId: outcome.mediaId, deduplicated: true });
      case 'created':
        return Response.json({ mediaId: outcome.mediaId, deduplicated: false });
    }
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return Response.json({ error: e.errCode }, { status: e.httpStatus });
    }
    throw e;
  }
});

interface ParsedMultipart {
  babyId?: string;
  entryId?: string;
  clientUploadId?: string;
  file?: formidable.File;
}

async function parseMultipart(req: Request): Promise<ParsedMultipart> {
  // Keep the multipart landing dir on the SAME device as the data dir. The
  // pipeline renames this file into media/_staging, and fs.rename across
  // devices (e.g. container /tmp vs a bind-mounted data volume) throws EXDEV.
  const tmp = join(dataDir, 'media', '_tmp');
  await mkdir(tmp, { recursive: true });
  const form = formidable({
    uploadDir: tmp,
    keepExtensions: false,
    maxFileSize: 1024 * 1024 * 1024,
    multiples: false
  });
  const nodeReq = toNodeIncoming(req);

  return await new Promise((resolve, reject) => {
    form.parse(nodeReq, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      const get = (key: string): string | undefined => {
        const value = fields[key];
        if (!value) return undefined;
        return Array.isArray(value) ? value[0] : value;
      };
      const fileValue = files.file as formidable.File[] | formidable.File | undefined;
      resolve({
        babyId: get('babyId'),
        entryId: get('entryId'),
        clientUploadId: get('clientUploadId'),
        file: Array.isArray(fileValue) ? fileValue[0] : fileValue
      });
    });
  });
}

function toNodeIncoming(req: Request): IncomingMessage {
  const readable = Readable.fromWeb(req.body as any) as unknown as IncomingMessage;
  (readable as any).headers = Object.fromEntries(req.headers.entries());
  (readable as any).method = req.method;
  (readable as any).url = '/';
  return readable;
}
