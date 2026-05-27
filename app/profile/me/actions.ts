'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getAuth } from '@/lib/server/auth/server';
import { getDb } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';
import type { FormActionResult } from '@/components/features/EditMeForm';

const nameSchema = z.string().trim().min(1, '请输入昵称').max(50, '昵称最多 50 个字');

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export async function updateMyName(name: string): Promise<FormActionResult> {
  const session = await requireSession();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? '保存失败' };

  const { db } = getDb({ dataDir });
  db.update(users)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .run();
  revalidatePath('/profile');
  revalidatePath('/profile/me');
  return { ok: true, message: '已保存' };
}

async function requireSession() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');
  return session;
}
