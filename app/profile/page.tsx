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
  const canUseTrash = member.role === 'owner' || member.role === 'editor';
  const personalLinks = [
    { href: '/profile/me', label: '我的资料' },
    { href: '/timeline', label: '回到时间线' }
  ];
  const ownerLinks = [
    { href: '/profile/babies', label: '宝宝管理' },
    { href: '/profile/members', label: '成员管理' },
    { href: '/profile/members/permissions', label: '宝宝权限' },
    { href: '/profile/milestones', label: '里程碑设置' },
    { href: '/profile/data', label: '数据' }
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
      <nav className="grid gap-[var(--space-4)]">
        <ProfileSection links={personalLinks} />
        {isOwner && <ProfileSection title="家庭管理" links={ownerLinks} />}
        {canUseTrash && <ProfileSection title="回收站" links={[{ href: '/profile/trash', label: '最近删除' }]} />}
      </nav>
    </AppShell>
  );
}

function ProfileSection({ title, links }: { title?: string; links: Array<{ href: string; label: string }> }) {
  return (
    <section aria-label={title}>
      {title && <h2 className="mb-[var(--space-2)] px-[var(--space-1)] text-[var(--text-xs)] font-bold text-[var(--color-fg-soft)]">{title}</h2>}
      <Card className="px-0 py-0">
        <ul>
          {links.map((link) => (
            <li key={link.href} className="border-b border-[var(--color-border-light)] last:border-b-0">
              <Link href={link.href} className="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] text-[var(--text-md)] font-semibold text-[var(--color-fg)]">
                <span>{link.label}</span>
                <span aria-hidden="true" className="text-[var(--color-fg-soft)]">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
