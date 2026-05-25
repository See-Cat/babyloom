import { eq } from 'drizzle-orm';
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
  media,
  milestones,
  users
} from '@/lib/db/schema';
import type { MediaItem } from '@/lib/media/types';
import { ForbiddenError, NotFoundError } from '@/lib/permissions/errors';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';
import { EntryDetailView } from '@/components/features/EntryDetailView';

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
    .select({
      mediaId: entryMedia.mediaId,
      type: media.type,
      durationSec: media.durationSec,
      filename: media.filename
    })
    .from(entryMedia)
    .innerJoin(media, eq(media.id, entryMedia.mediaId))
    .where(eq(entryMedia.entryId, entry.id))
    .all();
  const mediaItems: MediaItem[] = attachedMedia.map((item) => ({
    id: item.mediaId,
    type: item.type === 'video' ? 'video' : 'photo',
    durationSec: item.durationSec ?? null,
    filename: item.filename
  }));

  return (
    <EntryDetailView
      entry={entry}
      babyName={baby?.name}
      babyBirthday={baby?.birthday}
      authorName={author?.name}
      authorImage={author?.image}
      milestoneNames={attached.map((m) => m.name)}
      mediaItems={mediaItems}
      canEdit={canEdit}
    />
  );
}
