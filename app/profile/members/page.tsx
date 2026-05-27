import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/server/db/client';
import { babies, familyMembers } from '@/lib/server/db/schema';
import MembersAdminPage from './MembersAdminClient';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function MembersAdminRoute() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const member = db
    .select({ role: familyMembers.role, familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  if (member?.role !== 'owner') notFound();

  const initialBabies = db
    .select({ id: babies.id, name: babies.name, avatarUrl: babies.avatarUrl })
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .orderBy(babies.createdAt)
    .all();

  return <MembersAdminPage initialBabies={initialBabies} />;
}
