import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { EditMeForm } from '@/components/features/EditMeForm';
import { AppShell } from '@/components/mobile/AppShell';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';
import { changeMyPassword, updateMyName } from './actions';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function MePage() {
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
  if (!me) redirect('/login');

  return (
    <AppShell title="我的资料">
      <Card className="mb-[var(--space-4)]">
        <div className="flex items-center justify-between gap-[var(--space-3)]">
          <div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--color-fg-strong)]">{me.name}</h2>
            <p className="text-[var(--text-sm)] text-[var(--color-muted)]">@{me.username}</p>
          </div>
          <Tag variant="neutral">{member.role}</Tag>
        </div>
      </Card>
      <EditMeForm
        initial={{ name: me.name, username: me.username }}
        updateMyName={updateMyName}
        changeMyPassword={changeMyPassword}
      />
    </AppShell>
  );
}
