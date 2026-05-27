import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { BackupPanel } from '@/components/features/BackupPanel';
import { AppShell } from '@/components/mobile/AppShell';
import { Card } from '@/components/ui/Card';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/server/db/client';
import { babies, entries, familyMembers, media } from '@/lib/server/db/schema';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function ProfileDataPage() {
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

  const stats = [
    {
      label: '宝宝',
      value: db.select().from(babies).where(eq(babies.familyId, caller.familyId)).all().length
    },
    {
      label: '记录',
      value: db
        .select({ id: entries.id })
        .from(entries)
        .innerJoin(babies, eq(babies.id, entries.babyId))
        .where(eq(babies.familyId, caller.familyId))
        .all().length
    },
    {
      label: '媒体',
      value: db
        .select({ id: media.id })
        .from(media)
        .innerJoin(babies, eq(babies.id, media.babyId))
        .where(eq(babies.familyId, caller.familyId))
        .all().length
    }
  ];

  return (
    <AppShell
      title="数据导出"
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
      <div className="grid gap-[var(--space-4)]">
        <Card>
          <div className="grid grid-cols-3 gap-[var(--space-3)] text-center">
            {stats.map((item) => (
              <div key={item.label}>
                <p className="text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg-strong)]">
                  {item.value}
                </p>
                <p className="mt-[var(--space-1)] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-muted)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="grid gap-[var(--space-3)]">
          <div>
            <h2 className="text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">
              完整备份
            </h2>
            <p className="mt-[var(--space-1)] text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-muted)]">
              导出会打包当前可恢复的数据快照和媒体文件,不包含登录会话。
            </p>
          </div>
          <BackupPanel />
        </Card>

        <Card className="px-0 py-0">
          <Link
            href="/profile/data/logs"
            className="flex items-center px-[var(--space-5)] py-[var(--space-4)] text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg)] active:bg-[var(--color-press-tint)]"
          >
            <span>查看系统日志</span>
            <ChevronRightIcon className="ml-auto h-4 w-4 text-[color:var(--color-fg-soft)]" />
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
