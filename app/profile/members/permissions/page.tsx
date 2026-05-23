import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers } from '@/lib/db/schema';
import { listPermissions } from '@/lib/db/queries/permissions';
import { evaluate } from '@/lib/permissions/assert';
import { AppShell } from '@/components/mobile/AppShell';
import { Card } from '@/components/ui/Card';
import { PermissionsMatrix } from '@/components/features/PermissionsMatrix';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function PermissionsPage() {
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

  const rows = listPermissions({ db, familyId: caller.familyId });
  const babies = Array.from(new Map(rows.map((row) => [row.baby.id, row.baby])).values());
  const members = Array.from(new Map(rows.map((row) => [row.member.id, row.member])).values()).map(
    (member) => ({
      ...member,
      effectiveAccess: babies.map((baby) => {
        const override = rows.find(
          (row) => row.member.id === member.id && row.baby.id === baby.id
        )?.override;
        const canRead = evaluate({
          role: member.role,
          userId: member.userId,
          action: 'baby:read',
          ownership: { babyId: baby.id },
          override
        }).allow;
        const canWrite = evaluate({
          role: member.role,
          userId: member.userId,
          action: 'entry:write',
          ownership: { babyId: baby.id, authorId: member.userId },
          override
        }).allow;
        const canDelete = evaluate({
          role: member.role,
          userId: member.userId,
          action: 'entry:trash',
          ownership: { babyId: baby.id, authorId: member.userId },
          override
        }).allow;
        const labels = [
          canRead ? '读' : null,
          canWrite ? '写' : null,
          canDelete ? '删' : null
        ].filter(Boolean);
        return `${baby.name}: ${labels.length ? labels.join(' ') : '无访问'}`;
      })
    })
  );

  return (
    <AppShell
      title="宝宝权限"
      leftSlot={
        <Link href="/profile/members" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
          返回
        </Link>
      }
      className="max-w-6xl"
    >
      <Card className="mb-[var(--space-4)] border-l-4 border-l-[var(--color-warning)]">
        <div className="flex flex-col gap-[var(--space-2)] text-[length:var(--text-sm)] leading-6">
          <p className="font-semibold text-[color:var(--color-fg-strong)]">
            此处的勾选只能收窄家庭成员的宝宝访问范围,不能授予超出其角色的权限。
          </p>
          <p className="text-[color:var(--color-muted)]">
            永久删除任何资源、管理宝宝、管理成员、管理家庭、管理里程碑、系统备份/日志始终只允许 owner。
          </p>
          <p className="text-[color:var(--color-muted)]">
            没有覆盖行时使用角色默认权限；勾选不会让 viewer 获得写入或删除能力。
          </p>
        </div>
      </Card>

      <Card>
        <PermissionsMatrix
          members={members}
          babies={babies}
          overrides={rows.map((row) => ({
            memberId: row.member.id,
            babyId: row.baby.id,
            override: row.override
          }))}
        />
      </Card>
    </AppShell>
  );
}
