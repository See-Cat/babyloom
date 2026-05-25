'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface BabySwitcherBaby {
  id: string;
  name: string;
  image?: string | null;
  ageLabel: string;
}

export function BabySwitcher({
  activeBabyId,
  babies,
  trigger
}: {
  activeBabyId: string;
  babies: BabySwitcherBaby[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  function selectBaby(babyId: string) {
    setOpen(false);
    if (babyId !== activeBabyId) {
      try {
        document.cookie = `bl_baby=${babyId}; path=/; max-age=${60 * 60 * 24 * 365}`;
      } catch {}
    }
    router.push(`/timeline?babyId=${babyId}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="contents"
      >
        {trigger}
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="切换宝宝">
        <div className="flex flex-col">
          {babies.map((baby) => {
            const active = baby.id === activeBabyId;
            return (
              <button
                key={baby.id}
                type="button"
                onClick={() => selectBaby(baby.id)}
                className={cn(
                  'flex items-center gap-[var(--space-3)] rounded-[14px] px-[6px] py-[10px] text-left',
                  active && 'bg-[var(--color-surface)]'
                )}
              >
                <Avatar src={baby.image ?? undefined} name={baby.name} size="sm" />
                <span className="flex-1 text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
                  {baby.name}
                </span>
                <span className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
                  {baby.ageLabel}
                </span>
                {active && <CheckIcon className="h-4 w-4 text-[color:var(--color-primary-active)]" />}
              </button>
            );
          })}
          <a
            href="/onboarding/baby"
            className="mt-[6px] flex items-center gap-[10px] border-t border-[color:var(--color-border-light)] px-[6px] pt-[14px] text-[length:var(--text-base)] font-bold text-[color:var(--color-primary-active)]"
          >
            <PlusIcon className="h-4 w-4" /> 添加新宝宝
          </a>
        </div>
      </BottomSheet>
    </>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mt-[var(--space-6)] flex justify-center">
      <Button type="button" variant="text" disabled={pending} onClick={onClick} className="text-[color:var(--color-error-active)]">
        {pending ? '退出中…' : '退出登录'}
      </Button>
    </div>
  );
}
