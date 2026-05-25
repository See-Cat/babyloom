import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';
import { AppShell } from '@/components/mobile/AppShell';
import { InstallChip } from '@/components/features/InstallChip';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ChevronRightIcon } from '@/components/ui/icons';

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
  const personalLinks: ProfileLink[] = [
    { href: '/profile/me', label: '我的资料', icon: 'user' },
    { href: '/timeline', label: '回到时间线', icon: 'sprout' }
  ];
  const ownerLinks: ProfileLink[] = [
    { href: '/profile/babies', label: '宝宝管理', icon: 'baby' },
    { href: '/profile/members', label: '成员管理', icon: 'members' },
    { href: '/profile/members/permissions', label: '宝宝权限', icon: 'shield' },
    { href: '/profile/milestones', label: '里程碑设置', icon: 'star' },
    { href: '/profile/data', label: '数据导出 / 备份', icon: 'download' }
  ];

  return (
    <AppShell title="我的">
      <Card className="mb-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <Avatar src={me?.image ?? undefined} name={me?.name ?? '我'} size="lg" />
          <div>
            <h2 className="text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg-strong)]">{me?.name}</h2>
            <p className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
              @{me?.username} · {roleLabel(member.role)}
            </p>
          </div>
        </div>
      </Card>
      <InstallChip />
      <nav className="grid gap-[var(--space-4)]">
        <ProfileSection links={personalLinks} />
        {isOwner && <ProfileSection title="家庭管理" links={ownerLinks} />}
        {canUseTrash && <ProfileSection title="其他" links={[{ href: '/profile/trash', label: '回收站', icon: 'trash' }]} />}
      </nav>
    </AppShell>
  );
}

type ProfileIcon = 'baby' | 'download' | 'members' | 'shield' | 'sprout' | 'star' | 'trash' | 'user';
type ProfileLink = { href: string; label: string; icon: ProfileIcon };

function ProfileSection({ title, links }: { title?: string; links: ProfileLink[] }) {
  return (
    <section aria-label={title}>
      {title && <h2 className="mb-[var(--space-2)] px-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-soft)]">{title}</h2>}
      <Card className="px-0 py-0">
        <ul>
          {links.map((link) => (
            <li key={link.href} className="border-b border-[var(--color-border-light)] last:border-b-0">
              <Link href={link.href} className="flex items-center gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)] text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg)] active:bg-[var(--color-press-tint)]">
                <ProfileRowIcon name={link.icon} />
                <span>{link.label}</span>
                <ChevronRightIcon className="ml-auto h-4 w-4 text-[color:var(--color-fg-soft)]" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function ProfileRowIcon({ name }: { name: ProfileIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0 fill-none stroke-current text-[color:var(--color-fg-soft)] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]">
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<ProfileIcon, ReactNode> = {
  baby: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="11" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="0.8" fill="currentColor" stroke="none" />
      <path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4c0 1-1 2-2 2H5c-1 0-2-1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
      <path d="M14.5 20c.5-2 2-3.5 4-3.5" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  sprout: (
    <>
      <path d="M12 21V10" />
      <path d="M12 10c-4 0-7-2-8-6 4 0 7 2 8 6z" />
      <path d="M12 12c4 0 7-2 8-6-4 0-7 2-8 6z" />
    </>
  ),
  star: <path d="M12 2.5L14.5 9h7L16 13.5l2 7-6-4-6 4 2-7L2.5 9h7L12 2.5z" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4c0-1 .5-2 2-2h4c1.5 0 2 1 2 2v2" />
      <path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </>
  )
};

function roleLabel(role: string) {
  if (role === 'owner') return '家庭主理人';
  if (role === 'editor') return '编辑成员';
  return '仅查看';
}
