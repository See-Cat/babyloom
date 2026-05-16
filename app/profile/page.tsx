import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';

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

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">{me?.name}</h1>
      <p className="text-sm opacity-60 mb-6">
        @{me?.username} · {member.role}
      </p>
      <nav className="flex flex-col gap-2">
        <Link href="/timeline" className="border rounded p-3 hover:bg-gray-50">
          ← 回到时间线
        </Link>
        {isOwner && (
          <>
            <Link href="/profile/babies" className="border rounded p-3 hover:bg-gray-50">
              宝宝管理
            </Link>
            <Link href="/profile/members" className="border rounded p-3 hover:bg-gray-50">
              成员管理
            </Link>
            <Link href="/profile/milestones" className="border rounded p-3 hover:bg-gray-50">
              里程碑设置
            </Link>
          </>
        )}
        {!isOwner && <p className="text-sm opacity-60 px-3 py-2">其他设置仅 owner 可见</p>}
      </nav>
    </main>
  );
}
