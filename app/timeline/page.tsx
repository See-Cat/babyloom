import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { loadConfig } from '@/lib/config/load';
import { getDb } from '@/lib/db/client';
import { getDayUtcRange } from '@/lib/db/queries/calendar';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { babies, entries, entryMedia, familyMembers, media, users } from '@/lib/db/schema';
import type { MediaItem } from '@/lib/media/types';
import { AppShell } from '@/components/mobile/AppShell';
import { TimelineCard } from '@/components/features/TimelineCard';
import { TimelineHero } from '@/components/features/TimelineHero';
import { Fab } from '@/components/ui/Fab';
import { Tag } from '@/components/ui/Tag';
import { PlusIcon } from '@/components/ui/icons';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string; date?: string }>;
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
  const timezone = loadConfig({ dataDir }).app.timezone;
  const dayRange = sp.date ? getDayUtcRange(sp.date, timezone) : null;

  const rows = db
    .select()
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .innerJoin(users, eq(users.id, entries.authorId))
    .where(
      and(
        eq(entries.babyId, selectedBabyId),
        eq(entries.status, 'active'),
        eq(babies.status, 'active'),
        dayRange ? gte(entries.occurredAt, dayRange.start) : undefined,
        dayRange ? lt(entries.occurredAt, dayRange.end) : undefined
      )
    )
    .orderBy(desc(entries.occurredAt))
    .all();
  const entryIds = rows.map((row) => row.entries.id);
  const bridges = entryIds.length
    ? db
        .select({
          entryId: entryMedia.entryId,
          mediaId: entryMedia.mediaId,
          type: media.type,
          durationSec: media.durationSec
        })
        .from(entryMedia)
        .innerJoin(media, eq(media.id, entryMedia.mediaId))
        .where(inArray(entryMedia.entryId, entryIds))
        .all()
    : [];
  const mediaItemsByEntry = new Map<string, MediaItem[]>();
  for (const bridge of bridges) {
    const list = mediaItemsByEntry.get(bridge.entryId) ?? [];
    list.push({
      id: bridge.mediaId,
      type: bridge.type === 'video' ? 'video' : 'photo',
      durationSec: bridge.durationSec ?? null
    });
    mediaItemsByEntry.set(bridge.entryId, list);
  }
  const mediaIdsByEntry = new Map<string, string[]>();
  for (const [entryId, items] of mediaItemsByEntry) {
    mediaIdsByEntry.set(entryId, items.map((item) => item.id));
  }
  const heroRow = rows.find((row) => (mediaIdsByEntry.get(row.entries.id)?.length ?? 0) > 0) ?? rows[0];
  const listRows = heroRow ? rows.filter((row) => row.entries.id !== heroRow.entries.id) : rows;

  return (
    <AppShell
      title={`${selectedBaby.name}的成长`}
      subtitle={formatBabyAge(selectedBaby.birthday)}
    >
      {dayRange && sp.date && (
        <div className="mb-[var(--space-4)]">
          <Link href={`/timeline?babyId=${selectedBabyId}`}>
            <Tag variant="neutral">{sp.date} · 回到全部</Tag>
          </Link>
        </div>
      )}

      <div className="mb-[var(--space-4)]">
        <TimelineHero
          babyId={selectedBabyId}
          entry={heroRow?.entries}
          authorName={heroRow?.user.name}
          mediaItems={heroRow ? mediaItemsByEntry.get(heroRow.entries.id) ?? [] : []}
        />
      </div>

      {listRows.length > 0 && (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {listRows.map((row, index) => (
            <li key={row.entries.id}>
              <TimelineCard
                entry={row.entries}
                authorName={row.user.name}
                authorImage={row.user.image}
                mediaItems={mediaItemsByEntry.get(row.entries.id) ?? []}
                animationDelayMs={100 + index * 60}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="py-[var(--space-6)] text-center text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">到这里啦</p>
      <Fab href={`/entry/new?babyId=${selectedBabyId}`} icon={<PlusIcon />} label="新记录" />
    </AppShell>
  );
}

function formatBabyAge(birthday: string) {
  const birth = new Date(`${birthday.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return '成长记录';
  const now = new Date();
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const days = Math.max(1, Math.floor((Date.now() - birth.getTime()) / 86_400_000) + 1);

  if (years > 0) return `${years}岁${restMonths}月 · 第 ${days} 天`;
  return `${restMonths}个月 · 第 ${days} 天`;
}
