import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/db/client';
import { listReadableBabies } from '@/lib/db/queries/permissions';
import { familyMembers } from '@/lib/db/schema';
import { LogoutButton } from '@/app/profile/BabySwitcher';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function NoAccessPage() {
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

  // If access has been granted (or the user is owner), bounce them to timeline.
  const readable = listReadableBabies({
    db,
    familyId: member.familyId,
    familyMemberId: member.id,
    role: (member.role === 'owner' ? 'owner' : 'member') as 'owner' | 'member',
    userId: session.user.id
  });
  if (readable.length > 0) redirect('/timeline');

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-[var(--space-6)] pt-[var(--space-10)]">
        <div
          aria-hidden
          className="mb-[var(--space-5)] flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[40px]"
        >
          🐣
        </div>
        <h1 className="mb-[var(--space-2)] text-center text-[length:var(--text-2xl)] font-bold text-[color:var(--color-fg-strong)]">
          暂未关联宝宝
        </h1>
        <p className="mb-[var(--space-6)] text-center text-[length:var(--text-base)] text-[color:var(--color-fg-soft)]">
          请联系家庭主理人为你授权关联宝宝后再使用
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
