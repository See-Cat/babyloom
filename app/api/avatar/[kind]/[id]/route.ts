import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { avatarFilePath, type AvatarKind } from '@/lib/server/avatar/paths';
import { jsonNotFound, UUID_RE } from '@/lib/permissions/responses';
import { withAuthorizedActionRoute } from '@/lib/permissions/route-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export const GET = withAuthorizedActionRoute({ action: 'baby:read' })(async (req) => {
  const parts = new URL(req.url).pathname.split('/');
  const kind = parts.at(-2) ?? '';
  const filename = parts.at(-1) ?? '';
  if (!isAvatarKind(kind) || !filename.endsWith('.webp')) return jsonNotFound();

  const id = filename.slice(0, -'.webp'.length);
  if (!UUID_RE.test(id)) return jsonNotFound();

  try {
    const body = await readFile(avatarFilePath(kind, id, dataDir));
    return new Response(body, {
      headers: {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch {
    return jsonNotFound();
  }
});

function isAvatarKind(kind: string): kind is AvatarKind {
  return kind === 'users' || kind === 'babies';
}
