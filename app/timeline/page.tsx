import { and, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { babies, entries, familyMembers } from '@/lib/db/schema';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string }>;
}) {
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

  const familyBabies = db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();

  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const sp = await searchParams;
  const selectedBabyId =
    sp.babyId && familyBabies.some((baby) => baby.id === sp.babyId)
      ? sp.babyId
      : familyBabies[0].id;

  const rows = db
    .select()
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(
      and(
        eq(entries.babyId, selectedBabyId),
        eq(entries.status, 'active'),
        eq(babies.status, 'active')
      )
    )
    .orderBy(desc(entries.occurredAt))
    .all();

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">时间线</h1>
        <div className="flex gap-2">
          <Link href="/profile" className="text-sm border rounded px-3 py-1.5">
            我
          </Link>
          <Link
            href={`/entry/new?babyId=${selectedBabyId}`}
            className="bg-black text-white text-sm rounded px-3 py-1.5"
          >
            + 新记录
          </Link>
        </div>
      </header>

      {familyBabies.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {familyBabies.map((baby) => (
            <Link
              key={baby.id}
              href={`/timeline?babyId=${baby.id}`}
              className={`px-3 py-1.5 text-sm rounded border ${
                baby.id === selectedBabyId ? 'bg-black text-white' : ''
              }`}
            >
              {baby.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm opacity-60 text-center mt-8">还没有记录</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.entries.id} className="border rounded p-3">
              <Link href={`/entry/${row.entries.id}`} className="block">
                <p className="text-xs opacity-60 mb-1">
                  {new Date(row.entries.occurredAt).toLocaleString('zh-CN')}
                </p>
                <p className="line-clamp-3 whitespace-pre-wrap">{row.entries.content}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
