'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/server/auth/server';
import { ownerInternalEmail } from '@/lib/server/bootstrap/owner';
import { ensureStartup } from '@/instrumentation.node';

const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: '请输入用户名和密码' };
  }

  await ensureStartup();
  const auth = getAuth({ dataDir });
  const hdrs = await headers();

  try {
    await auth.api.signInEmail({
      body: { email: ownerInternalEmail(username), password },
      headers: hdrs
    });
  } catch {
    return { error: '用户名或密码错误' };
  }

  redirect('/');
}
