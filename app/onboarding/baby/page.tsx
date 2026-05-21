'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export default function OnboardingBabyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gender, setGender] = useState('other');

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
        birthday: String(formData.get('birthday') ?? ''),
        gender: String(formData.get('gender') ?? 'other')
      })
    });
    setPending(false);
    if (!res.ok) {
      setError('创建失败,请检查输入');
      return;
    }
    router.push('/timeline');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-[var(--space-6)]">
      <Card className="w-full max-w-md">
      <form action={onSubmit} className="flex flex-col gap-[var(--space-4)]">
        <div>
          <h1 className="text-[var(--text-hero)] font-bold text-[var(--color-fg-strong)]">第一个宝宝</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-muted)]">先添加一个宝宝才能开始记录</p>
        </div>
        <Input name="name" required placeholder="宝宝名字" label="宝宝名字" />
        <Input name="birthday" required type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}" placeholder="2026-05-21" label="生日" />
        <input type="hidden" name="gender" value={gender} />
        <div className="flex flex-col gap-1 text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
          <span>性别</span>
          <SegmentedControl
            ariaLabel="性别"
            value={gender}
            onChange={setGender}
            className="grid-cols-3"
            options={[
              { value: 'girl', label: '女宝' },
              { value: 'boy', label: '男宝' },
              { value: 'other', label: '其他' }
            ]}
          />
        </div>
        {error && <p role="alert" className="text-[var(--text-sm)] text-[var(--color-error)]">{error}</p>}
        <Button type="submit" disabled={pending} fullWidth>
          {pending ? '创建中…' : '创建宝宝'}
        </Button>
      </form>
      </Card>
    </main>
  );
}
