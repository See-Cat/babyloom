import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/server/db/client';
import { babyMemberPermissions, familyMembers } from '@/lib/server/db/schema';
import { listReadableBabies } from '@/lib/server/db/queries/permissions';
import { BulkUploadView } from './BulkUploadView';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function BulkUploadPage() {
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
    const hasWriteable = db
      .select({ id: babyMemberPermissions.id })
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.familyMemberId, member.id),
          eq(babyMemberPermissions.canWrite, 1)
        )
      )
      .get();
    if (!hasWriteable) notFound();
  }

  const familyBabies = listReadableBabies({
    db,
    familyId: member.familyId,
    familyMemberId: member.id,
    role: (member.role === 'owner' ? 'owner' : 'member') as 'owner' | 'member',
    userId: session.user.id
  });
  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const cookieBabyId = (await cookies()).get('bl_baby')?.value;
  const fromCookie = cookieBabyId ? familyBabies.find((b) => b.id === cookieBabyId) : undefined;
  const activeBaby = fromCookie ?? familyBabies[0];

  return <BulkUploadView babyId={activeBaby.id} babyName={activeBaby.name} />;
}
