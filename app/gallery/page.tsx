import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { groupMediaByMonth, listGalleryMedia } from '@/lib/db/queries/gallery';
import { GalleryGrid } from '@/components/features/GalleryGrid';
import { AppShell } from '@/components/mobile/AppShell';
import { Tag } from '@/components/ui/Tag';

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

  const familyBabies = db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();
  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const sp = await searchParams;
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : familyBabies[0].id;
  const groups = groupMediaByMonth(listGalleryMedia({ db, babyId: selectedBabyId }));

  return (
    <AppShell title="画廊">
      <BabyTabs babies={familyBabies} selectedBabyId={selectedBabyId} route="/gallery" />
      <GalleryGrid groups={groups} />
    </AppShell>
  );
}

function BabyTabs({
  babies,
  selectedBabyId,
  route
}: {
  babies: Array<{ id: string; name: string }>;
  selectedBabyId: string;
  route: string;
}) {
  if (babies.length <= 1) return null;
  return (
    <div className="mb-[var(--space-4)] flex gap-[var(--space-2)] overflow-x-auto">
      {babies.map((baby) => (
        <Link key={baby.id} href={`${route}?babyId=${baby.id}`}>
          <Tag variant={baby.id === selectedBabyId ? 'accent' : 'neutral'}>{baby.name}</Tag>
        </Link>
      ))}
    </div>
  );
}
