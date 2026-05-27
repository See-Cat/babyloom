import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/db/client';
import { babyMemberPermissions, familyMembers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import TrashClient from './TrashClient';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function TrashPage() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  if (!member) redirect('/login');
  if (member.role !== 'owner') {
    const hasDeletable = db
      .select({ id: babyMemberPermissions.id })
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.familyMemberId, member.id),
          eq(babyMemberPermissions.canDelete, 1)
        )
      )
      .get();
    if (!hasDeletable) redirect('/profile');
  }

  const role: 'owner' | 'member' = member.role === 'owner' ? 'owner' : 'member';
  return <TrashClient role={role} />;
}
