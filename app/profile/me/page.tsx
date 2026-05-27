import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { EditMeForm } from '@/components/features/EditMeForm';
import { AppShell } from '@/components/mobile/AppShell';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { updateMyName } from './actions';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function MePage() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const me = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!me) redirect('/login');

  return (
    <AppShell
      title="我的资料"
      leftSlot={
        <Link
          href="/profile"
          aria-label="返回"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </Link>
      }
    >
      <EditMeForm
        initial={{ name: me.name, image: me.image ?? null }}
        username={me.username}
        target="me"
        updateMyName={updateMyName}
      />
    </AppShell>
  );
}
