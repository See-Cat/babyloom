import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { runBackup } from '@/lib/server/backup/run';
import { ServiceUnavailableError } from '@/lib/permissions/errors';
import { jsonServiceUnavailable } from '@/lib/permissions/responses';
import { withAuthorizedAction } from '@/lib/permissions/action-template';

export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export const POST = withAuthorizedAction({ action: 'system:backup' })(async () => {
  let backup: Awaited<ReturnType<typeof runBackup>> | null = null;
  try {
    backup = await runBackup({ dataDir });
  } catch (e) {
    if (e instanceof ServiceUnavailableError) {
      return jsonServiceUnavailable(e.detail, e.retryAfterSeconds);
    }
    return Response.json({ error: 'backup_failed' }, { status: 500 });
  }

  const nodeStream = createReadStream(backup.zipPath);
  nodeStream.on('close', () => {
    void backup?.cleanup();
  });

  return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${backup.filename}"`,
      'X-Backup-Sha256': backup.sha256
    }
  });
});
