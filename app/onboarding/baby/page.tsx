'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CameraIcon } from '@/components/ui/icons';

export default function OnboardingBabyPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [baby, setBaby] = useState({ name: '', birthday: '', gender: 'girl' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

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
    if (!res.ok) {
      setPending(false);
      setError('创建失败,请检查输入');
      return;
    }
    const data = await res.json();
    if (avatarFile && data?.id) {
      const form = new FormData();
      form.set('target', `baby:${data.id}`);
      form.set('file', avatarFile);
      await fetch('/api/avatar', { method: 'POST', body: form }).catch(() => undefined);
    }
    setPending(false);
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
          <button
            type="button"
            aria-label="选择头像"
            onClick={() => fileRef.current?.click()}
            className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full focus-visible:outline-[3px] focus-visible:outline-[color:var(--color-focus)]"
          >
            <Avatar
              src={previewUrl ?? undefined}
              name={baby.name || '宝宝'}
              colorKey={baby.name || 'baby-onboarding'}
              size="xl"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-[2px] -right-[2px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)] ring-[3px] ring-[var(--color-bg)]"
            >
              <CameraIcon className="h-3.5 w-3.5" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => setAvatarFile(event.currentTarget.files?.[0] ?? null)}
          />
          <p className="text-center text-[length:var(--text-xs)] font-medium text-[color:var(--color-fg-soft)]">头像可选 · 不上传时自动用名字首字</p>
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
          {error && (
            <p role="alert" className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] bg-[var(--color-error-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-error-active)]">
              <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-error)] text-[length:var(--text-xs)] font-bold text-white">!</span>
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} loading={pending} fullWidth size="lg" className="mt-[var(--space-2)]">
            {pending ? '创建中…' : '开始记录'}
          </Button>
        </div>
      </form>
    </main>
  );
}
