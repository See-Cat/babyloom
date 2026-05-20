import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { loadConfig } from '@/lib/config/load';
import { getDb } from '@/lib/db/client';
import { buildMonthGrid, formatDateInTimezone, listEntryDays } from '@/lib/db/queries/calendar';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { familyMembers } from '@/lib/db/schema';
import { MonthCalendar } from '@/components/features/MonthCalendar';
import { AppShell } from '@/components/mobile/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string; ym?: string }>;
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

  const config = loadConfig({ dataDir });
  const timezone = config.app.timezone;
  const sp = await searchParams;
  const ym = isYm(sp.ym) ? sp.ym : formatDateInTimezone(Date.now(), timezone).slice(0, 7);
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : familyBabies[0].id;
  const grid = buildMonthGrid(ym, timezone);
  const daySet = listEntryDays({ db, babyId: selectedBabyId, ym, timezone });
  const todayIso = formatDateInTimezone(Date.now(), timezone);

  return (
    <AppShell title="日历">
      <BabyTabs babies={familyBabies} selectedBabyId={selectedBabyId} ym={ym} />
      <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-3)]">
        <Link href={`/calendar?babyId=${selectedBabyId}&ym=${shiftMonth(ym, -1)}`}>
          <Button variant="ghost" size="sm">上一月</Button>
        </Link>
        <h2 className="text-[var(--text-lg)] font-bold text-[var(--color-fg-strong)]">{monthLabel(ym)}</h2>
        <Link href={`/calendar?babyId=${selectedBabyId}&ym=${shiftMonth(ym, 1)}`}>
          <Button variant="ghost" size="sm">下一月</Button>
        </Link>
      </div>
      <MonthCalendar babyId={selectedBabyId} grid={grid} daySet={daySet} todayIso={todayIso} />
    </AppShell>
  );
}

function BabyTabs({
  babies,
  selectedBabyId,
  ym
}: {
  babies: Array<{ id: string; name: string; avatarUrl: string | null }>;
  selectedBabyId: string;
  ym: string;
}) {
  if (babies.length <= 1) return null;
  return (
    <div className="mb-[var(--space-4)] flex gap-[var(--space-2)] overflow-x-auto">
      {babies.map((baby) => (
        <Link key={baby.id} href={`/calendar?babyId=${baby.id}&ym=${ym}`}>
          <Tag variant={baby.id === selectedBabyId ? 'accent' : 'neutral'}>
            <Avatar src={baby.avatarUrl ?? undefined} name={baby.name} size="sm" />
            {baby.name}
          </Tag>
        </Link>
      ))}
    </div>
  );
}

function isYm(value: string | undefined): value is string {
  return Boolean(value?.match(/^\d{4}-(0[1-9]|1[0-2])$/));
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  return `${year} 年 ${month} 月`;
}
