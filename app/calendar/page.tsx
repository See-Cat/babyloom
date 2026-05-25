import { and, eq, gte, lt } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { loadConfig } from '@/lib/config/load';
import { getDb } from '@/lib/db/client';
import { buildMonthGrid, formatDateInTimezone, getDayUtcRange, listEntryDays } from '@/lib/db/queries/calendar';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { babies, entries, familyMembers, users } from '@/lib/db/schema';
import { CalendarDayPreview } from '@/components/features/CalendarDayPreview';
import { CalendarMonthNav } from '@/components/features/CalendarMonthNav';
import { MonthCalendar } from '@/components/features/MonthCalendar';
import { AppShell } from '@/components/mobile/AppShell';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string; ym?: string; date?: string }>;
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
  const cookieBabyId = (await cookies()).get('bl_baby')?.value;
  const fallbackBabyId =
    (cookieBabyId && familyBabies.some((baby) => baby.id === cookieBabyId) ? cookieBabyId : familyBabies[0].id);
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : fallbackBabyId;
  const selectedBaby = familyBabies.find((baby) => baby.id === selectedBabyId) ?? familyBabies[0];
  const grid = buildMonthGrid(ym, timezone);
  const daySet = listEntryDays({ db, babyId: selectedBabyId, ym, timezone });
  const todayIso = formatDateInTimezone(Date.now(), timezone);
  const selectedIso = isIsoDate(sp.date) && sp.date.startsWith(`${ym}-`) ? sp.date : todayIso.startsWith(`${ym}-`) ? todayIso : `${ym}-01`;
  const selectedRange = getDayUtcRange(selectedIso, timezone) ?? getDayUtcRange(`${ym}-01`, timezone);
  const selectedRows = db
    .select({
      id: entries.id,
      content: entries.content,
      occurredAt: entries.occurredAt,
      authorName: users.name
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .innerJoin(users, eq(users.id, entries.authorId))
    .where(
      and(
        eq(entries.babyId, selectedBabyId),
        eq(entries.status, 'active'),
        eq(babies.status, 'active'),
        gte(entries.occurredAt, selectedRange!.start),
        lt(entries.occurredAt, selectedRange!.end)
      )
    )
    .orderBy(entries.occurredAt)
    .all();

  return (
    <AppShell title="日历" subtitle={`${selectedBaby.name} · ${formatBabyAge(selectedBaby.birthday, selectedIso)}`}>
      <CalendarMonthNav babyId={selectedBabyId} ym={ym} birthdayYm={selectedBaby.birthday?.slice(0, 7)} />
      <MonthCalendar babyId={selectedBabyId} ym={ym} grid={grid} daySet={daySet} todayIso={todayIso} selectedIso={selectedIso} />
      <CalendarDayPreview
        babyId={selectedBabyId}
        selectedIso={selectedIso}
        babyAge={formatBabyAge(selectedBaby.birthday, selectedIso)}
        entries={selectedRows}
      />
    </AppShell>
  );
}

function isYm(value: string | undefined): value is string {
  return Boolean(value?.match(/^\d{4}-(0[1-9]|1[0-2])$/));
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value?.match(/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/));
}

function formatBabyAge(birthday: string, isoDate: string) {
  const birth = new Date(`${birthday.slice(0, 10)}T00:00:00Z`);
  const at = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return '成长记录';
  let months = (at.getUTCFullYear() - birth.getUTCFullYear()) * 12 + at.getUTCMonth() - birth.getUTCMonth();
  if (at.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const days = Math.max(1, Math.floor((at.getTime() - birth.getTime()) / 86_400_000) + 1);

  if (years > 0) return `${years}岁${restMonths}月 · 第 ${days} 天`;
  return `${restMonths}个月 · 第 ${days} 天`;
}
