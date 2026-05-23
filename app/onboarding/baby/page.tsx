'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export default function OnboardingBabyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [baby, setBaby] = useState({ name: '', birthday: '', gender: 'girl' });

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
        birthday: String(formData.get('birthday') ?? ''),
        gender: String(formData.get('gender') ?? 'girl')
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
    <main className="min-h-screen bg-[var(--color-bg)]">
      <div className="h-[6px] bg-[linear-gradient(90deg,var(--color-primary),var(--color-avatar-pink),var(--color-warning))] opacity-20" />
      <form action={onSubmit} className="mx-auto flex w-full max-w-md flex-col px-[var(--space-6)] pt-[var(--space-8)]">
        <div className="mb-[var(--space-5)] flex items-center justify-center gap-[var(--space-2)] text-[length:var(--text-xs)] font-bold uppercase tracking-[0.04em] text-[color:var(--color-fg-soft)]">
          <span className="h-2 w-6 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--color-border-light)]" />
          <span>添加第一个宝宝</span>
        </div>
        <div className="mb-[var(--space-4)] text-center">
          <h1 className="text-[length:var(--text-2xl)] font-bold text-[color:var(--color-fg-strong)]">第一个宝宝</h1>
          <p className="text-[length:var(--text-base)] text-[color:var(--color-fg-soft)]">先添加一个宝宝,就可以开始记录啦</p>
        </div>
        <div className="mb-[var(--space-4)] flex flex-col items-center gap-[var(--space-2)]">
          <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[var(--color-avatar-pink)] text-[34px] font-bold text-[color:var(--color-fg-inverse)]">
            {initialFor(baby.name)}
          </span>
          <p className="text-center text-[length:var(--text-xs)] font-medium text-[color:var(--color-fg-soft)]">头像可稍后在宝宝管理里设置</p>
        </div>
        <div className="flex flex-col gap-[var(--space-4)]">
          <Input
            name="name"
            required
            placeholder="例如 小乐"
            label="名字"
            value={baby.name}
            onChange={(event) => setBaby({ ...baby, name: event.target.value })}
          />
          <DatePicker
            name="birthday"
            required
            label="生日"
            value={baby.birthday}
            onChange={(birthday) => setBaby({ ...baby, birthday })}
          />
          <input type="hidden" name="gender" value={baby.gender} />
          <div className="flex flex-col gap-1 text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg)]">
            <span>性别</span>
            <SegmentedControl
              ariaLabel="性别"
              value={baby.gender}
              onChange={(gender) => setBaby({ ...baby, gender })}
              className="grid-cols-2"
              options={[
                { value: 'boy', label: '男宝' },
                { value: 'girl', label: '女宝' }
              ]}
            />
          </div>
          {error && <p role="alert" className="rounded-[var(--radius-sm)] bg-[var(--color-error-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-error-active)]">{error}</p>}
          <Button type="submit" disabled={pending} loading={pending} fullWidth size="lg" className="mt-[var(--space-2)]">
            {pending ? '创建中…' : '开始记录'}
          </Button>
        </div>
      </form>
    </main>
  );
}

function initialFor(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return /^[a-z]/i.test(trimmed) ? trimmed[0].toUpperCase() : trimmed[0];
}
