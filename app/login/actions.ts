'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: '请输入邮箱和密码' };
  }

  const auth = getAuth({ dataDir });
  const hdrs = await headers();

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: hdrs
    });
  } catch {
    return { error: '邮箱或密码错误' };
  }

  redirect('/');
}
