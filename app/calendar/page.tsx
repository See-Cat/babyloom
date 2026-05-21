import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { loadConfig } from '@/lib/config/load';
import { getDb } from '@/lib/db/client';
import { buildMonthGrid, formatDateInTimezone, listEntryDays } from '@/lib/db/queries/calendar';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { familyMembers } from '@/lib/db/schema';
import { CalendarMonthNav } from '@/components/features/CalendarMonthNav';
import { MonthCalendar } from '@/components/features/MonthCalendar';
import { AppShell } from '@/components/mobile/AppShell';

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
  const selectedBaby = familyBabies.find((baby) => baby.id === selectedBabyId) ?? familyBabies[0];
  const grid = buildMonthGrid(ym, timezone);
  const daySet = listEntryDays({ db, babyId: selectedBabyId, ym, timezone });
  const todayIso = formatDateInTimezone(Date.now(), timezone);

  return (
    <AppShell title="日历" subtitle={selectedBaby.name}>
      <CalendarMonthNav babyId={selectedBabyId} ym={ym} />
      <MonthCalendar babyId={selectedBabyId} grid={grid} daySet={daySet} todayIso={todayIso} />
    </AppShell>
  );
}

function isYm(value: string | undefined): value is string {
  return Boolean(value?.match(/^\d{4}-(0[1-9]|1[0-2])$/));
}
