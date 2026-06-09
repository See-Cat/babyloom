import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { AppShell } from '@/components/mobile/AppShell';
import { Card } from '@/components/ui/Card';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { getAuth } from '@/lib/server/auth/server';
import { loadConfig } from '@/lib/server/config/load';
import { getDb } from '@/lib/server/db/client';
import { familyMembers } from '@/lib/server/db/schema';
import { countEligibleOrphans } from '@/lib/server/media/reconcile';
import { getCleanupSettings, MAX_THRESHOLD_HOURS, MIN_THRESHOLD_HOURS } from '@/lib/server/settings/cleanup';
import { MediaCleanupClient } from './MediaCleanupClient';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function ProfileCleanupPage() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const caller = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  if (caller?.role !== 'owner') notFound();

  const settings = getCleanupSettings({ dataDir });
  const eligibleCount = countEligibleOrphans({
    dataDir,
    nowMs: Date.now(),
    thresholdHours: settings.thresholdHours
  });
  const timeZone = loadConfig({ dataDir }).app.timezone;

  return (
    <AppShell
      title="媒体清理"
      leftSlot={
        <Link
          href="/profile"
          aria-label="返回"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </Link>
      }
    >
      <Card>
        <MediaCleanupClient
          initial={{
            enabled: settings.enabled,
            thresholdHours: settings.thresholdHours,
            lastRunAt: settings.lastRunAt,
            lastRunDeleted: settings.lastRunDeleted,
            minThresholdHours: MIN_THRESHOLD_HOURS,
            maxThresholdHours: MAX_THRESHOLD_HOURS,
            eligibleCount
          }}
          timeZone={timeZone}
        />
      </Card>
    </AppShell>
  );
}
