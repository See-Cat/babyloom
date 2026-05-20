import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';
import { AppShell } from '@/components/mobile/AppShell';
import { InstallChip } from '@/components/features/InstallChip';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function ProfilePage() {
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
  const me = db.select().from(users).where(eq(users.id, session.user.id)).get();

  const isOwner = member.role === 'owner';
  const links = [
    { href: '/profile/me', label: '我的资料' },
    { href: '/timeline', label: '回到时间线' },
    { href: '/profile/trash', label: '垃圾桶' },
    ...(isOwner
      ? [
          { href: '/profile/babies', label: '宝宝管理' },
          { href: '/profile/members', label: '成员管理' },
          { href: '/profile/members/permissions', label: '宝宝权限' },
          { href: '/profile/milestones', label: '里程碑设置' },
          { href: '/profile/data', label: '数据' }
        ]
      : [])
  ];

  return (
    <AppShell title="我的">
      <Card className="mb-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <Avatar src={me?.image ?? undefined} name={me?.name ?? '我'} size="lg" />
          <div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--color-fg-strong)]">{me?.name}</h2>
            <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
              @{me?.username} · {member.role}
            </p>
          </div>
        </div>
      </Card>
      <InstallChip />
      <nav className="grid gap-[var(--space-3)]">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card interactive>{link.label}</Card>
          </Link>
        ))}
        {!isOwner && <p className="px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-muted)]">其他设置仅 owner 可见</p>}
      </nav>
    </AppShell>
  );
}
