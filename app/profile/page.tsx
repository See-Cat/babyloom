import { and, eq, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { babies, entries, familyMembers, milestones, users } from '@/lib/db/schema';
import { AppShell } from '@/components/mobile/AppShell';
import { InstallChip } from '@/components/features/InstallChip';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ChevronRightIcon, PencilIcon } from '@/components/ui/icons';
import { BabySwitcher, LogoutButton, type BabySwitcherBaby } from './BabySwitcher';

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
  const canBulkUpload = member.role === 'owner' || member.role === 'editor';

  const familyBabies = listReadableBabies({
    db,
    familyId: member.familyId,
    familyMemberId: member.id,
    role: member.role as 'owner' | 'editor' | 'viewer',
    userId: session.user.id
  });

  const cookieStore = await cookies();
  const cookieBabyId = cookieStore.get('bl_baby')?.value;
  const activeBaby =
    (cookieBabyId && familyBabies.find((b) => b.id === cookieBabyId)) ?? familyBabies[0] ?? null;

  const memberCount = isOwner
    ? db
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, member.familyId))
        .get()?.count ?? 0
    : 0;
  const milestoneCount = isOwner
    ? db
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(milestones)
        .where(eq(milestones.familyId, member.familyId))
        .get()?.count ?? 0
    : 0;
  const trashCount = canUseTrash
    ? db
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(entries)
        .innerJoin(babies, eq(babies.id, entries.babyId))
        .where(and(eq(entries.status, 'trashed'), eq(babies.familyId, member.familyId)))
        .get()?.count ?? 0
    : 0;

  const switcherBabies: BabySwitcherBaby[] = familyBabies.map((b) => ({
    id: b.id,
    name: b.name,
    image: (b as any).image ?? null,
    ageLabel: formatBabyAge(b.birthday)
  }));

  const ownerLinks: ProfileLink[] = [
    { href: '/profile/babies', label: '宝宝管理', icon: 'baby', meta: `${familyBabies.length} 个` },
    { href: '/profile/members', label: '成员管理', icon: 'members', meta: `${memberCount} 人` },
    { href: '/profile/members/permissions', label: '宝宝权限', icon: 'shield' },
    { href: '/profile/milestones', label: '里程碑设置', icon: 'star', meta: `${milestoneCount} 个` },
    { href: '/profile/data', label: '数据导出 / 备份', icon: 'download' }
  ];
  const otherLinks: ProfileLink[] = [];
  if (canBulkUpload) otherLinks.push({ href: '/profile/bulk-upload', label: '批量补传历史照片', icon: 'upload' });
  if (canUseTrash) otherLinks.push({ href: '/profile/trash', label: '回收站', icon: 'trash', meta: `${trashCount} 条` });
  otherLinks.push({ href: 'https://github.com/anthropics/babyloom#readme', label: '关于 Babyloom', icon: 'info', external: true });

  return (
    <AppShell title="我的">
      <Card className="mb-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <Avatar src={me?.image ?? undefined} name={me?.name ?? '我'} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg-strong)]">{me?.name}</h2>
            <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-2)]">
              <span className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">@{me?.username}</span>
              <RolePill role={member.role} />
            </div>
          </div>
          <Link
            href="/profile/me"
            aria-label="编辑我的资料"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
          >
            <PencilIcon />
          </Link>
        </div>
      </Card>

      {activeBaby && (
        <Card variant="tinted" tint="mint" className="mb-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <Avatar src={(activeBaby as any).image ?? undefined} name={activeBaby.name} colorKey={activeBaby.id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.04em] text-[color:var(--color-primary-active)]">
                正在记录
              </p>
              <p className="truncate text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
                {activeBaby.name} · {formatBabyAge(activeBaby.birthday)}
              </p>
            </div>
            {familyBabies.length > 1 && (
              <BabySwitcher
                activeBabyId={activeBaby.id}
                babies={switcherBabies}
                trigger={
                  <span className="inline-flex items-center gap-[4px] rounded-[var(--radius-pill)] bg-[var(--color-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)] shadow-[var(--shadow-press-sm)]">
                    切换 <ChevronRightIcon className="h-3.5 w-3.5" />
                  </span>
                }
              />
            )}
          </div>
        </Card>
      )}

      <InstallChip />
      <nav className="grid gap-[var(--space-4)]">
        {isOwner && <ProfileSection title="家庭管理" links={ownerLinks} />}
        {otherLinks.length > 0 && <ProfileSection title="其他" links={otherLinks} />}
      </nav>
      <LogoutButton />
    </AppShell>
  );
}

type ProfileIcon = 'baby' | 'download' | 'info' | 'members' | 'shield' | 'sprout' | 'star' | 'trash' | 'upload' | 'user';
type ProfileLink = { href: string; label: string; icon: ProfileIcon; meta?: string; external?: boolean };

function ProfileSection({ title, links }: { title?: string; links: ProfileLink[] }) {
  return (
    <section aria-label={title}>
      {title && <h2 className="mb-[var(--space-2)] px-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-soft)]">{title}</h2>}
      <Card className="px-0 py-0">
        <ul>
          {links.map((link) => {
            const inner = (
              <>
                <ProfileRowIcon name={link.icon} />
                <span>{link.label}</span>
                {link.meta && (
                  <span className="ml-auto text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">{link.meta}</span>
                )}
                <ChevronRightIcon className={`${link.meta ? 'ml-[var(--space-2)]' : 'ml-auto'} h-4 w-4 text-[color:var(--color-fg-soft)]`} />
              </>
            );
            return (
              <li key={link.href} className="border-b border-[var(--color-border-light)] last:border-b-0">
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)] text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg)] active:bg-[var(--color-press-tint)]"
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className="flex items-center gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)] text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg)] active:bg-[var(--color-press-tint)]"
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

function RolePill({ role }: { role: string }) {
  const config =
    role === 'owner'
      ? { label: '家庭主理人', bg: 'var(--color-primary-bg)', fg: 'var(--color-primary-active)' }
      : role === 'editor'
        ? { label: '编辑成员', bg: 'var(--color-warning-bg, var(--color-primary-bg))', fg: 'var(--color-warning-active, var(--color-primary-active))' }
        : { label: '仅查看', bg: 'var(--color-surface)', fg: 'var(--color-fg-soft)' };
  return (
    <span
      className="inline-flex rounded-[var(--radius-pill)] px-[var(--space-2)] py-[2px] text-[length:var(--text-xs)] font-bold"
      style={{ background: config.bg, color: config.fg }}
    >
      {config.label}
    </span>
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
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
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
  upload: (
    <>
      <path d="M21 15v4c0 1-1 2-2 2H5c-1 0-2-1-2-2v-4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M12 4v12" />
    </>
  ),
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

function formatBabyAge(birthday: string) {
  const birth = new Date(`${birthday.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return '成长记录';
  const now = new Date();
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years > 0) return `${years}岁${rest}月`;
  return `${rest}个月`;
}
