'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <div className="h-[6px] bg-[linear-gradient(90deg,var(--color-primary),var(--color-avatar-pink),var(--color-warning))] opacity-20" />
      <form action={onSubmit} className="mx-auto flex min-h-[calc(100vh-6px)] w-full max-w-sm flex-col justify-center px-[var(--space-6)]">
        <div className="mb-[var(--space-7)] text-center">
          <div aria-hidden="true" className="mb-[var(--space-2)] text-[48px] leading-none">🌱</div>
          <h1 className="text-[length:var(--text-hero)] font-bold text-[color:var(--color-fg-strong)]">Babyloom</h1>
          <p className="text-[length:var(--text-base)] text-[color:var(--color-fg-soft)]">登录到家庭记录本</p>
        </div>
        <div className="flex flex-col gap-[var(--space-4)]">
          <Input name="username" type="text" required placeholder="例如 mama" label="用户名" autoComplete="username" />
          <Input name="password" type="password" required placeholder="密码" label="密码" autoComplete="current-password" error={error ?? undefined} />
          <Button type="submit" disabled={pending} loading={pending} fullWidth size="lg">
            {pending ? '登录中…' : '登录'}
          </Button>
        </div>
      </form>
    </main>
  );
}
