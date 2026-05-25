import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers } from '@/lib/db/schema';
import { groupMediaByMonth, listGalleryMedia } from '@/lib/db/queries/gallery';
import { listReadableBabies } from '@/lib/db/queries/permissions';
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
    role: member.role as 'owner' | 'editor' | 'viewer',
    userId: session.user.id
  });
  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const sp = await searchParams;
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : familyBabies[0].id;
  const selectedBaby = familyBabies.find((baby) => baby.id === selectedBabyId) ?? familyBabies[0];
  const groups = groupMediaByMonth(listGalleryMedia({ db, babyId: selectedBabyId }));
  const mediaCount = groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <AppShell title="画廊" subtitle={`${selectedBaby.name} · ${mediaCount > 0 ? `共 ${mediaCount} 张` : '还没有照片'}`}>
      <GalleryGrid babyId={selectedBabyId} groups={groups} />
    </AppShell>
  );
}
