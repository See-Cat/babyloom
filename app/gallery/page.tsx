import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/server/db/client';
import { loadConfig } from '@/lib/server/config/load';
import { familyMembers } from '@/lib/server/db/schema';
import { groupMediaByMonth, listGalleryMedia } from '@/lib/server/db/queries/gallery';
import { canWriteToBaby, listReadableBabies } from '@/lib/server/db/queries/permissions';
import { GalleryGrid } from '@/components/features/GalleryGrid';
import { AppShell } from '@/components/mobile/AppShell';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function GalleryPage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string }>;
}) {
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

  const familyBabies = listReadableBabies({
    db,
    familyId: member.familyId,
    familyMemberId: member.id,
    role: (member.role === 'owner' ? 'owner' : 'member') as 'owner' | 'member',
    userId: session.user.id
  });
  if (familyBabies.length === 0) {
    redirect(member.role === 'owner' ? '/onboarding/baby' : '/no-access');
  }

  const sp = await searchParams;
  const cookieBabyId = (await cookies()).get('bl_baby')?.value;
  const fallbackBabyId =
    (cookieBabyId && familyBabies.some((baby) => baby.id === cookieBabyId) ? cookieBabyId : familyBabies[0].id);
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : fallbackBabyId;
  const selectedBaby = familyBabies.find((baby) => baby.id === selectedBabyId) ?? familyBabies[0];
  const role: 'owner' | 'member' = member.role === 'owner' ? 'owner' : 'member';
  const canWrite = canWriteToBaby({ db, familyMemberId: member.id, role, babyId: selectedBabyId });
  const timezone = loadConfig({ dataDir }).app.timezone;
  const groups = groupMediaByMonth(listGalleryMedia({ db, babyId: selectedBabyId, timeZone: timezone }), timezone);
  const mediaCount = groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <AppShell title="画廊" subtitle={`${selectedBaby.name} · ${mediaCount > 0 ? `共 ${mediaCount} 张` : '还没有照片'}`} stickyHeader={false}>
      <GalleryGrid babyId={selectedBabyId} groups={groups} canWrite={canWrite} />
    </AppShell>
  );
}
