'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-[var(--space-4)]">
      <Card className="w-full max-w-sm">
        <form action={onSubmit} className="flex flex-col gap-[var(--space-4)]">
          <div className="text-center">
            <h1 className="text-[var(--text-hero)] font-bold text-[var(--color-fg-strong)]">BabyLoom</h1>
            <p className="text-[var(--text-sm)] text-[var(--color-muted)]">登录家庭记录本</p>
          </div>
          <Input name="username" type="text" required placeholder="用户名" label="用户名" />
          <Input name="password" type="password" required placeholder="密码" label="密码" />
          {error && <p role="alert" className="text-[var(--text-sm)] text-[var(--color-error)]">{error}</p>}
          <Button type="submit" disabled={pending} fullWidth>
            {pending ? '登录中…' : '登录'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
