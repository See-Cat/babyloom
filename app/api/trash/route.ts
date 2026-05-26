import { resolve } from 'node:path';
import {
  countTrashedByType,
  listTrashed,
  memberHasAnyCanDelete,
  type TrashType
} from '@/lib/db/queries/trash';
import { jsonBadRequest, jsonNotFound } from '@/lib/permissions/responses';
import { withAuthorizedActionRoute } from '@/lib/permissions/route-template';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const TRASH_TYPES = new Set(['entries', 'media', 'babies']);

function parseType(value: string | null): TrashType | null {
  const type = value ?? 'entries';
  return TRASH_TYPES.has(type) ? (type as TrashType) : null;
}

export const GET = withAuthorizedActionRoute({
  action: 'trash:view',
  allowRoles: ['owner', 'member']
})(async (req, viewer) => {
  // gate: non-owner must hold canDelete=1 on at least one baby
  if (viewer.role !== 'owner' && !memberHasAnyCanDelete({ dataDir, userId: viewer.userId })) {
    return jsonNotFound();
  }

  const url = new URL(req.url);
  const type = parseType(url.searchParams.get('type'));
  if (!type) return jsonBadRequest('bad_type');

  const rows = listTrashed({
    type,
    cursor: url.searchParams.get('cursor'),
    viewer,
    dataDir
  });
  const nextCursor =
    rows.length > 50 ? `${rows[50].deletedAt}:${rows[50].id}` : null;

  return Response.json({
    rows: rows.slice(0, 50),
    counts: countTrashedByType({ viewer, dataDir }),
    nextCursor
  });
});
