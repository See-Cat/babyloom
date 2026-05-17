import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import {
  babies,
  entryMedia,
  entryMilestones,
  familyMembers,
  milestones,
  users
} from '@/lib/db/schema';
import { ForbiddenError, NotFoundError } from '@/lib/permissions/errors';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';
import { Gallery } from '@/components/media/Gallery';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function EntryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  let entry: any;
  try {
    entry = await loadAndAssertTarget({
      id,
      table: 'entries',
      allowedStatuses: ['active'],
      requirePermission: { userId: session.user.id, action: 'entry:read' },
      dataDir
    });
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof NotFoundError) notFound();
    throw e;
  }

  const { db } = getDb({ dataDir });
  const author = db.select().from(users).where(eq(users.id, entry.authorId)).get();
  const baby = db.select().from(babies).where(eq(babies.id, entry.babyId)).get();
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  const canEdit =
    member?.role === 'owner' || (member?.role === 'editor' && entry.authorId === session.user.id);
  const attached = db
    .select({ id: milestones.id, name: milestones.name, icon: milestones.icon })
    .from(entryMilestones)
    .innerJoin(milestones, eq(milestones.id, entryMilestones.milestoneId))
    .where(eq(entryMilestones.entryId, entry.id))
    .all();
  const attachedMedia = db
    .select({ mediaId: entryMedia.mediaId })
    .from(entryMedia)
    .where(eq(entryMedia.entryId, entry.id))
    .all();

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex gap-3 text-sm mb-2">
        <Link href={`/timeline?babyId=${entry.babyId}`} className="opacity-60">
          ← 时间线
        </Link>
        {canEdit && (
          <Link href={`/entry/${entry.id}/edit`} className="text-blue-600">
            编辑
          </Link>
        )}
      </div>
      <article className="mt-4">
        <header className="mb-4">
          <p className="text-xs opacity-60">
            {baby?.name} · {new Date(entry.occurredAt).toLocaleString('zh-CN')}
          </p>
          <p className="text-xs opacity-60">作者:{author?.name ?? '未知'}</p>
        </header>
        <p className="whitespace-pre-wrap text-base">{entry.content}</p>
        {attached.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attached.map((m) => (
              <span key={m.id} className="px-2 py-1 text-xs border rounded">
                {m.icon} {m.name}
              </span>
            ))}
          </div>
        )}
        <Gallery mediaIds={attachedMedia.map((media) => media.mediaId)} />
      </article>
    </main>
  );
}
