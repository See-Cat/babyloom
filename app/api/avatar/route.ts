import { eq } from 'drizzle-orm';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { avatarFilePath, avatarPublicUrl } from '@/lib/server/avatar/paths';
import {
  AvatarDecodeError,
  AvatarTooLargeError,
  AvatarUnsupportedError,
  processAvatar
} from '@/lib/server/avatar/process';
import { getDb } from '@/lib/server/db/client';
import { babies, users } from '@/lib/server/db/schema';
import { assertPermission } from '@/lib/server/permissions/assert';
import { ForbiddenError, NotFoundError } from '@/lib/server/permissions/errors';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/server/permissions/responses';
import { withAuthorizedActionRoute } from '@/lib/server/permissions/route-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export const POST = withAuthorizedActionRoute({ action: 'baby:read' })(async (req, { userId }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonBadRequest('invalid_multipart');
  }

  const target = String(form.get('target') ?? '');
  const file = form.get('file');
  if (!(file instanceof File)) return jsonBadRequest('file_required');

  const resolved = parseTarget(target, userId);
  if (!resolved) return jsonBadRequest('target_required');

  try {
    if (resolved.kind === 'babies') {
      await assertPermission(userId, 'baby:write', { babyId: resolved.id }, { dataDir });
    }
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
    throw e;
  }

  let output: Buffer;
  try {
    output = await processAvatar(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof AvatarTooLargeError) {
      return Response.json({ error: e.code }, { status: 413 });
    }
    if (e instanceof AvatarUnsupportedError || e instanceof AvatarDecodeError) {
      return jsonBadRequest(e.code);
    }
    throw e;
  }

  const path = avatarFilePath(resolved.kind, resolved.id, dataDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, output);
  await rename(`${path}.tmp`, path);
  const mtime = Math.trunc((await stat(path)).mtimeMs);
  const url = avatarPublicUrl(resolved.kind, resolved.id, mtime);

  const { db } = getDb({ dataDir });
  if (resolved.kind === 'users') {
    db.update(users)
      .set({ image: url, updatedAt: new Date() })
      .where(eq(users.id, resolved.id))
      .run();
  } else {
    db.update(babies)
      .set({ avatarUrl: url, updatedAt: Date.now() })
      .where(eq(babies.id, resolved.id))
      .run();
  }

  return Response.json({ url });
});

export const DELETE = withAuthorizedActionRoute({ action: 'baby:read' })(async (req, { userId }) => {
  const target = new URL(req.url).searchParams.get('target') ?? '';
  const resolved = parseTarget(target, userId);
  if (!resolved) return jsonBadRequest('target_required');

  try {
    if (resolved.kind === 'babies') {
      await assertPermission(userId, 'baby:write', { babyId: resolved.id }, { dataDir });
    }
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
    throw e;
  }

  try {
    await unlink(avatarFilePath(resolved.kind, resolved.id, dataDir));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  const { db } = getDb({ dataDir });
  if (resolved.kind === 'users') {
    db.update(users)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(users.id, resolved.id))
      .run();
  } else {
    db.update(babies)
      .set({ avatarUrl: null, updatedAt: Date.now() })
      .where(eq(babies.id, resolved.id))
      .run();
  }

  return Response.json({ ok: true });
});

function parseTarget(target: string, userId: string) {
  if (target === 'me') return { kind: 'users' as const, id: userId };
  if (!target.startsWith('baby:')) return null;
  const babyId = target.slice('baby:'.length);
  if (!UUID_RE.test(babyId)) return null;
  return { kind: 'babies' as const, id: babyId };
}
