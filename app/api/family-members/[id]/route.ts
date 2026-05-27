import { eq, sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { entries, entryMedia, familyMembers, media, users } from '@/lib/db/schema';
import { resetMemberPassword } from '@/lib/members/create';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMember(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      userId: users.id,
      username: users.username,
      nickname: users.name,
      memberId: familyMembers.id,
      familyId: familyMembers.familyId,
      role: familyMembers.role
    })
    .from(users)
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .where(eq(users.id, id))
    .get();
  return row ?? null;
}

const patchSchema = z.object({
  password: z.string().min(8).max(200)
});

export const PATCH = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_modify_owner_via_api' }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('invalid_request');

  resetMemberPassword({ dataDir, userId: row.userId, newPassword: parsed.data.password });
  return Response.json({ updated: row.userId });
});

export const DELETE = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: (row: any) => row.status ?? 'active',
  allowedStatuses: ['active'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (_req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_delete_owner' }, { status: 409 });
  }
  const { db } = getDb({ dataDir });
  const { accounts, sessions } = await import('@/lib/db/schema');

  db.transaction((tx) => {
    // 1. Revoke login + drop family membership. accounts has ON DELETE CASCADE
    //    on users.id, but we delete it explicitly so the user can no longer
    //    authenticate even before we decide users-row fate below.
    tx.delete(sessions).where(eq(sessions.userId, row.userId)).run();
    tx.delete(accounts).where(eq(accounts.userId, row.userId)).run();
    tx.delete(familyMembers).where(eq(familyMembers.id, row.memberId)).run();

    // 2. users.id is referenced as NOT NULL FK by entries.authorId /
    //    media.uploadedBy / entryMedia.attachedBy (no cascade). Hard-delete
    //    only when there are no such references.
    const refCount =
      (tx
        .select({ c: sql<number>`count(*)`.as('c') })
        .from(entries)
        .where(eq(entries.authorId, row.userId))
        .get()?.c ?? 0) +
      (tx
        .select({ c: sql<number>`count(*)`.as('c') })
        .from(media)
        .where(eq(media.uploadedBy, row.userId))
        .get()?.c ?? 0) +
      (tx
        .select({ c: sql<number>`count(*)`.as('c') })
        .from(entryMedia)
        .where(eq(entryMedia.attachedBy, row.userId))
        .get()?.c ?? 0);

    if (refCount === 0) {
      tx.delete(users).where(eq(users.id, row.userId)).run();
    } else {
      // Keep the user row for FK integrity, but free up the username slot
      // and scrub the email so a fresh signup can reuse them. Nullable
      // deletedBy refs on babies/entries/media still point here for audit.
      const tombstone = `__removed_${row.userId}__`;
      tx.update(users)
        .set({
          username: tombstone,
          email: `${tombstone}@removed.local`,
          updatedAt: new Date()
        })
        .where(eq(users.id, row.userId))
        .run();
    }
  });

  return Response.json({ removed: row.userId });
});
