import { resolve } from 'node:path';
import { assertWritesAllowed } from '@/lib/server/backup/write-barrier';
import { type TrashType } from '@/lib/db/queries/trash';
import { jsonBadRequest } from '@/lib/permissions/responses';
import { withAuthorizedActionRoute } from '@/lib/permissions/route-template';
import { bulkPurgeByType } from '@/lib/server/trash/empty';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const TRASH_TYPES = new Set(['entries', 'media', 'babies']);

function parseType(value: string | null): TrashType | null {
  const type = value ?? 'entries';
  return TRASH_TYPES.has(type) ? (type as TrashType) : null;
}

export const POST = withAuthorizedActionRoute({
  action: 'trash:empty',
  allowRoles: ['owner']
})(async (req, viewer) => {
  assertWritesAllowed();

  const type = parseType(new URL(req.url).searchParams.get('type'));
  if (!type) return jsonBadRequest('bad_type');

  const result = await bulkPurgeByType({ type, familyId: viewer.familyId, dataDir });
  return Response.json(result);
});
