import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { join, resolve } from 'node:path';
import { LogViewer } from '@/components/features/LogViewer';
import { AppShell } from '@/components/mobile/AppShell';
import { Card } from '@/components/ui/Card';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers } from '@/lib/db/schema';
import { tail, type LogRow } from '@/lib/logs/tail';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

interface LogsPageProps {
  searchParams?: Promise<{
    level?: string;
    module?: string;
    q?: string;
  }>;
}

export default async function ProfileDataLogsPage({ searchParams }: LogsPageProps) {
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

  const today = new Date().toISOString().slice(0, 10);
  const params = (await searchParams) ?? {};
  const rows = filterRows(
    await tail(join(dataDir, 'logs', `app-${today}.log`), 200),
    params
  );

  return (
    <AppShell
      title="系统日志"
      leftSlot={
        <Link href="/profile/data" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
          返回
        </Link>
      }
      className="max-w-6xl"
    >
      <Card>
        <LogViewer rows={rows} />
      </Card>
    </AppShell>
  );
}

function filterRows(rows: LogRow[], params: { level?: string; module?: string; q?: string }) {
  const level = params.level?.trim();
  const moduleName = params.module?.trim().toLowerCase();
  const query = params.q?.trim().toLowerCase();

  return rows.filter((row) => {
    if (level && levelLabel(row.level) !== level) return false;
    if (moduleName && !String(row.module ?? '').toLowerCase().includes(moduleName)) return false;
    if (query && !JSON.stringify(row).toLowerCase().includes(query)) return false;
    return true;
  });
}

function levelLabel(level: LogRow['level']) {
  if (level === 10) return 'trace';
  if (level === 20) return 'debug';
  if (level === 30) return 'info';
  if (level === 40) return 'warn';
  if (level === 50) return 'error';
  if (level === 60) return 'fatal';
  return String(level ?? '');
}
