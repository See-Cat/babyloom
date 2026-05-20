import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { loadConfig } from '@/lib/config/load';
import { getDb } from '@/lib/db/client';
import { getDayUtcRange } from '@/lib/db/queries/calendar';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { babies, entries, entryMedia, familyMembers, users } from '@/lib/db/schema';
import { AppShell } from '@/components/mobile/AppShell';
import { TimelineCard } from '@/components/features/TimelineCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

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
    role: member.role as 'owner' | 'editor' | 'viewer',
    userId: session.user.id
  });

  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const sp = await searchParams;
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : familyBabies[0].id;
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
        .select({ entryId: entryMedia.entryId, mediaId: entryMedia.mediaId })
        .from(entryMedia)
        .where(inArray(entryMedia.entryId, entryIds))
        .all()
    : [];
  const mediaIdsByEntry = new Map<string, string[]>();
  for (const bridge of bridges) {
    const list = mediaIdsByEntry.get(bridge.entryId) ?? [];
    list.push(bridge.mediaId);
    mediaIdsByEntry.set(bridge.entryId, list);
  }

  return (
    <AppShell
      title="时光"
      rightSlot={
        <Link href={`/entry/new?babyId=${selectedBabyId}`}>
          <Button size="sm">新记录</Button>
        </Link>
      }
    >
      {familyBabies.length > 1 && (
        <div className="mb-[var(--space-4)] flex gap-[var(--space-2)] overflow-x-auto">
          {familyBabies.map((baby) => (
            <Link
              key={baby.id}
              href={`/timeline?babyId=${baby.id}${sp.date ? `&date=${sp.date}` : ''}`}
            >
              <Tag variant={baby.id === selectedBabyId ? 'accent' : 'neutral'}>
                <Avatar src={baby.avatarUrl ?? undefined} name={baby.name} size="sm" />
                {baby.name}
              </Tag>
            </Link>
          ))}
        </div>
      )}

      {dayRange && sp.date && (
        <div className="mb-[var(--space-4)]">
          <Link href={`/timeline?babyId=${selectedBabyId}`}>
            <Tag variant="neutral">{sp.date} · 回到全部</Tag>
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-[var(--space-8)] text-center text-[var(--text-sm)] text-[var(--color-muted)]">还没有记录</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {rows.map((row) => (
            <li key={row.entries.id}>
              <TimelineCard
                entry={row.entries}
                authorName={row.user.name}
                authorImage={row.user.image}
                mediaIds={mediaIdsByEntry.get(row.entries.id) ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
